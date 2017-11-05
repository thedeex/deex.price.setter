/* app.js ver.4.0 */

/* ------------------------------------------------------------*/
// to have access to node, run with --rpc , and unlock account:
// geth --testnet --rpc --unlock 0
// for testrpc, just run:
// testrpc
//
// JS console
// MainNet:
// geth attach
// testrpc:
// geth attach http://localhost:8545
// Ropsten:
// geth attach ipc://${HOME}/.ethereum/testnet/geth.ipc
/* ------------------------------------------------------------*/

// Contract data:
var contractTruffleArtifactPath = './contracts/DEEX.json';
// like {"1": "0x1ikde..."} where "1" is the network id as in web3.version.network
var contractAddressesJsonPath = './contracts/DEEX.deployed.json';
var logFilePath = './logs/log.txt';

var fs = require('fs');

// http://telegraf.js.org/
// https://github.com/telegraf/telegraf
// https://github.com/telegraf/telegraf/blob/develop/docs/telegraf.md
// see also: https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-a-group-chat-id
const Telegraf = require('telegraf');
var tokenFilePath = './telegram/deex.bot.token.txt';
var chatId = '-1001125845737'; // deex-price-setter-log
var token = fs.readFileSync(tokenFilePath, "utf8");
var telegraf = new Telegraf(token);

// https://www.npmjs.com/package/jsonfile
var jsonfile = require('jsonfile');

// http://momentjs.com/docs/
// https://stackoverflow.com/questions/1197928/how-to-add-30-minutes-to-a-javascript-date-object
var moment = require('moment');

// https://www.npmjs.com/package/request
// https://github.com/request/request
var request = require('request');

// https://github.com/ethereum/wiki/wiki/JavaScript-API#adding-web3
// (!) use "web3": "^0.20.1" like truffle-contract uses, not the last version!
var Web3 = require('web3');
// Web3.js API Reference:
// https://github.com/ethereum/wiki/wiki/JavaScript-API#web3js-api-reference

// https://github.com/trufflesuite/truffle-contract#truffle-contract
var TruffleContract = require("truffle-contract");

var web3httpprovider = new Web3.providers.HttpProvider("http://localhost:8545");
var web3 = new Web3(web3httpprovider);

// check web3:
try {
    var check = web3.eth.accounts;
} catch (error) {
    console.log(error);
    console.log('Please check if your Ethereum node is started and --rpc option is provided');
    return;
}

var etherscan;

if (!web3.eth.defaultAccount && web3.eth.accounts.length > 0) {

    // default is web3.eth.accounts[0], change if needed
    if (web3.version.network === '1') {  //             MainNet
        web3.eth.defaultAccount = web3.eth.accounts[0];
        etherscan = 'https://etherscan.io/';
    } else if (web3.version.network === '3') { //       Ropsten
        web3.eth.defaultAccount = web3.eth.accounts[0];
        etherscan = 'https://ropsten.etherscan.io/';
    } else if (web3.version.network === '4') { //       Rinkeby
        web3.eth.defaultAccount = web3.eth.accounts[0];
        etherscan = 'https://rinkeby.etherscan.io/';
    } else if (web3.version.network.length === 13) { // testrpc
        web3.eth.defaultAccount = web3.eth.accounts[0];
        etherscan = 'https://etherscan.io/'; // not works for testrpc
    }

}
// or just set:
// web3.eth.defaultAccount = "";

console.log('web3.eth.accounts: ');
console.log(web3.eth.accounts);
console.log('web3.eth.defaultAccount:');
console.log(web3.eth.defaultAccount);

// see: https://ethereum.stackexchange.com/questions/26148/web3-isconnected-is-not-a-function
if (web3.isConnected()) {

    console.log('web3.version.network: ' + web3.version.network);

    var contractAddressesJson = jsonfile.readFileSync(contractAddressesJsonPath);
    var contractAddress = contractAddressesJson[web3.version.network];

    var Contract = TruffleContract(
        // >>> (!) check path:
        jsonfile.readFileSync(contractTruffleArtifactPath)
    );
    Contract.setProvider(web3.currentProvider);


    Contract.at(
        contractAddress
    ).then(
        function (contract) {

            // debug:
            // console.log(contract);

            console.log('contract deployed at: ', contract.address, 'on network: ', web3.version.network);

            // interval
            var intervalInMilliseconds;
            var oneMinuteInMilliseconds = 1000 * 60;
            var oneHourInMilliseconds = oneMinuteInMilliseconds * 60;

            // price change to be considered as significant
            var significantChangeInPercents;


            if (web3.version.network === '1') {  //             MainNet
                intervalInMilliseconds = oneHourInMilliseconds; // 1 hour
                significantChangeInPercents = 10; // %

            } else if (web3.version.network === '3') { //       Ropsten
                intervalInMilliseconds = oneMinuteInMilliseconds * 10; // 10 min
                significantChangeInPercents = 10; // %

            } else if (web3.version.network === '4') { //       Rinkeby
                intervalInMilliseconds = oneMinuteInMilliseconds * 10; // 10 min
                significantChangeInPercents = 10; // %

            } else if (web3.version.network.length === 13) { // testrpc
                intervalInMilliseconds = oneMinuteInMilliseconds; //
                significantChangeInPercents = 1; //
            }

            // debug:
            console.log("intervalInMilliseconds :", intervalInMilliseconds);

            var previousEthInUsd;
            var previousBonus;
            var bonusChanged;

            console.log("requesting sale start unix time: ");
            contract.saleStartUnixTime.call().then(function (saleStartUnixTime) {

                saleStartUnixTime = saleStartUnixTime.toNumber();
                // debug:
                console.log('saleStartUnixTime: ', saleStartUnixTime);

                if (saleStartUnixTime > 0) {

                    // >> main:
                    setInterval(
                        function () {

                            // check if this web3.eth.defaultAccount is a priceSetter in smart contract
                            contract.priceSetter.call().then(function (priceSetter) {

                                    if (web3.eth.defaultAccount.toLowerCase() === priceSetter.toLowerCase()) {

                                        contract.tokenPriceInWei.call().then(function (tokenPriceInWei) {

                                            var previousTokenPriceInWei = tokenPriceInWei.toNumber();

                                            /* ----- request ETH price from etherscan */
                                            var url = 'https://api.etherscan.io/api?module=stats&action=ethprice';

                                            request(url, function (error, response, body) {

                                                if (error) {
                                                    console.log('error:', error); // Print the error if one occurred
                                                }

                                                if (response) {
                                                    // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                                                }

                                                if (body) {

                                                    var ethescanEthPriceResponceBodyObject = JSON.parse(body);
                                                    // {
                                                    // "status":"1","message":"OK",
                                                    // "result":{"ethbtc":"0.05101","ethbtc_timestamp":"1509168225","ethusd":"294.02","ethusd_timestamp":"1509168223"}
                                                    // }

                                                    var ethInUsd = parseFloat(ethescanEthPriceResponceBodyObject.result.ethusd);

                                                    var usdInEth = 1 / ethInUsd;


                                                    // for debug only:
                                                    if (ethInUsd * usdInEth === 1 || ethInUsd * usdInEth === 0.9999999999999999) {
                                                        console.log('[debug] ethInUsd * usdInEth: ', ethInUsd * usdInEth);
                                                    } else {
                                                        console.log('ERROR: ethInUsd * usdInEth:  ', ethInUsd * usdInEth);
                                                        return;
                                                    }

                                                    var oneCentInETH = usdInEth * 0.01; // or: usdInEth/100
                                                    var oneCentInWei = oneCentInETH * Math.pow(10, 18); //  Math.pow(base, exponent)
                                                    console.log("(0.01 USD in wei: ", Math.round(oneCentInWei), ')');

                                                    var tenCentsInWei = (oneCentInWei * 10);

                                                    var newPriceBeforeBonusInWei = tenCentsInWei; // - at new ETH/USD rate

                                                    // 25, 30 etc. (%)
                                                    var currentBonus;

                                                    // https://stackoverflow.com/questions/7763327/how-to-calculate-date-difference-in-javascript
                                                    var datesDifferenceInDays = function (dateLater, dateEarlier) {
                                                        return Math.floor(
                                                            (dateLater - dateEarlier) / (1000 * 60 * 60 * 24)
                                                        );
                                                    };
                                                    // for tests
                                                    var datesDifferenceInHours = function (dateLater, dateEarlier) {
                                                        return datesDifferenceInDays(dateLater, dateEarlier) * 24;
                                                    };
                                                    // for tests
                                                    var datesDifferenceInTenMinutes = function (dateLater, dateEarlier) {
                                                        return datesDifferenceInHours(dateLater, dateEarlier) * 6;
                                                    };
                                                    var datesDifferenceInMinutes = function (dateLater, dateEarlier) {
                                                        return datesDifferenceInHours(dateLater, dateEarlier) * 60;
                                                    };

                                                    // saleStartUnixTime in pre-ICO in production (MainNet): 1509051600
                                                    // var preIcoStartDate = new Date("26 Oct 2017 21:00:00 GMT");
                                                    var preIcoStartDate = new Date(saleStartUnixTime * 1000);
                                                    // console.log('preIcoStartDate: ', preIcoStartDate);
                                                    var now = Date.now();
                                                    var diff;

                                                    if (web3.version.network === '1') {  //             MainNet

                                                        diff = datesDifferenceInDays(now, preIcoStartDate);

                                                    } else if (web3.version.network === '3') { //       Ropsten

                                                        diff = datesDifferenceInTenMinutes(now, preIcoStartDate)

                                                    } else if (web3.version.network === '4') { //       Rinkeby

                                                        diff = datesDifferenceInTenMinutes(now, preIcoStartDate)

                                                    } else if (web3.version.network.length === 13) { // testrpc
                                                        diff = datesDifferenceInMinutes(now, preIcoStartDate)
                                                    }

                                                    if (diff <= 10) {
                                                        currentBonus = 25;
                                                    }
                                                    else if (diff <= 15) {
                                                        currentBonus = 20;
                                                    }
                                                    else if (diff <= 20) {
                                                        currentBonus = 15;
                                                    }
                                                    else if (diff <= 23) {
                                                        currentBonus = 10;
                                                    }
                                                    else if (diff <= 26) {
                                                        currentBonus = 5;
                                                    }
                                                    else {
                                                        currentBonus = 0
                                                    }

                                                    bonusChanged = currentBonus !== previousBonus && typeof previousBonus !== 'undefined';

                                                    var newPriceInWei = Math.round(
                                                        newPriceBeforeBonusInWei - (newPriceBeforeBonusInWei / 100 * currentBonus)
                                                    );

                                                    var priceChangeInWei = newPriceInWei - previousTokenPriceInWei;

                                                    var priceChangeInPercents = Math.abs(newPriceInWei - previousTokenPriceInWei) / (previousTokenPriceInWei * 0.01);

                                                    var weiToUsdAtCurrentRate = function (sumInWei) {
                                                        return web3.fromWei(sumInWei, 'ether') * ethInUsd;
                                                    };

                                                    var timestampForLogMessage = new Date();
                                                    var logMessage = '\n[' + timestampForLogMessage.toUTCString() + ']' +
                                                        '\n ETH/USD: ' + ethInUsd + ' (last price change was at: ' + previousEthInUsd + ')' +
                                                        '\n USD/ETH: ' + usdInEth +
                                                        '\n Previous token price in wei (with bonus): ' + previousTokenPriceInWei +
                                                        ' (' + weiToUsdAtCurrentRate(previousTokenPriceInWei) + ' USD at current rate)' +
                                                        '\n New token price in wei before bonus: ' + newPriceBeforeBonusInWei +
                                                        '\n Current bonus: -' + currentBonus + '% from regular selling price, was:' + previousBonus + ', bonus changed: ' + bonusChanged +

                                                        '\n\n NEW TOKEN PRICE IN WEI: ' + newPriceInWei + ' (' + web3.fromWei(newPriceInWei, 'ether') + ' ETH or '
                                                        + weiToUsdAtCurrentRate(newPriceInWei) + ' USD)' +

                                                        '\n\n price change in wei :' + priceChangeInWei +
                                                        ' (' + web3.fromWei(priceChangeInWei, 'ether') + ' ETH or ' + weiToUsdAtCurrentRate(priceChangeInWei) + ' USD)' +
                                                        '\n price change in percents: ' + priceChangeInPercents + '% (significant change when >=' + significantChangeInPercents + '%)';

                                                    if (priceChangeInPercents >= significantChangeInPercents || bonusChanged) {

                                                        logMessage = logMessage + "\n this change is significant, price will be changed in smart contract "
                                                            + etherscan + 'address/' + contract.address + '\n';

                                                        console.log(logMessage);
                                                        fs.appendFileSync(logFilePath, logMessage);
                                                        telegraf.telegram.sendMessage(chatId, logMessage);

                                                        previousEthInUsd = ethInUsd;
                                                        previousBonus = currentBonus;

                                                        /* --- set new token price in wei in smart contract --- */

                                                        var txParameters = {}; // <<< (!) needed
                                                        txParameters.from = web3.eth.defaultAccount;
                                                        txParameters.gas = 4000000; //
                                                        contract.setTokenPriceInWei(
                                                            newPriceInWei,
                                                            txParameters
                                                        ).then(function (tx_id) {
                                                                console.log('[contract.setTokenPriceInWei] transaction success: ');
                                                                console.log(tx_id); // object
                                                            }
                                                        ).catch(function (error) {
                                                                console.log("[contract.setTokenPriceInWei] transaction failed:");
                                                                console.log(error);
                                                            }
                                                        ); // end of contract.setTokenPriceInWei


                                                    } else {
                                                        logMessage = logMessage + '\n this change is NOT significant, price in smart contract will NOT be changed\n';
                                                        fs.appendFileSync(logFilePath, logMessage);
                                                        telegraf.telegram.sendMessage(chatId, logMessage);
                                                        console.log(logMessage);

                                                    }

                                                } // end of if (body)
                                            });

                                        }).catch(function (error) {
                                            console.log(error);
                                        }); // end of contract.tokenPriceInWei.call()

                                    } else {
                                        console.log('ERROR: ');
                                        console.log(
                                            'web3.eth.defaultAccount: ' + web3.eth.defaultAccount.toLowerCase()
                                            + '; priceSetter: ' + priceSetter.toLowerCase()
                                        );
                                    }
                                }
                            ).catch(function (error) {
                                    console.log(error);
                                }
                            ); // end of contract.priceSetter.call()

                        },
                        intervalInMilliseconds
                    );

                    // ------------- on testrpc: initialize contract and start sale :

                } else if (web3.version.network.length === 13) { // > rules for Ropsten or Rinkeby can be added

                    //  function initContract(address team, address advisers, address bounty) public onlyBy(owner) returns (bool){
                    var txParameters = {}; // <<< (!) needed
                    txParameters.from = web3.eth.defaultAccount;
                    txParameters.gas = 4000000;
                    contract.initContract(
                        web3.eth.accounts[1],
                        web3.eth.accounts[2],
                        web3.eth.accounts[3],
                        txParameters
                    ).then(function (tx_id) {
                            console.log('[contract.initContract] transaction success: ');
                            console.log(tx_id); // object
                            // function startSale(uint256 _startUnixTime, uint256 _endUnixTime) public onlyBy(owner) returns (bool success){
                            // require(balanceOf[this] > 0);
                            var txParameters = {}; // <<< (!) needed
                            txParameters.from = web3.eth.defaultAccount;
                            txParameters.gas = 4000000; //
                            var startUnixTime = moment().add(3, 'm');
                            var endUnixTime = moment().add(32, 'm');
                            console.log('typeof startUnixTime: ', typeof startUnixTime.unix());
                            console.log('typeof endUnixTime; ', typeof endUnixTime.unix());
                            console.log(
                                'starting sale,',
                                'start time: ', startUnixTime.toDate().toLocaleString(), '(', startUnixTime.unix(), '),',
                                'end time: ', endUnixTime.toDate().toLocaleString(), ' (', endUnixTime.unix(), ') \n',
                                'txParameters: ', txParameters
                            );
                            contract.startSale(
                                startUnixTime.unix(),
                                endUnixTime.unix(),
                                txParameters
                            ).then(function (tx_id) {
                                    console.log('[contract.startSale] transaction success: ');
                                    console.log(tx_id); // object
                                    console.log("[testrpc] sale time set, please start this script again")
                                }
                            ).catch(function (error) {
                                    console.log("[contract.startSale] transaction failed:");
                                    console.log(error);
                                }
                            ); // end of contract.startSale()

                        }
                    ).catch(function (error) {
                            console.log("[contract.initContract] transaction failed:");
                            console.log(error);
                        }
                    );
                } else { // end of else if (web3.version.network.length === 13)
                    console.log('saleStartUnixTime is not set (value is 0)');
                }

            }).catch(function (error) {
                console.log(error);
            }); // end of contractInitialized.call();
        }
    ).catch(function (error) {
        console.log(error);
    }); // end of function(contract)

} else {
    console.log("ERROR: web3.isConnected() : " + web3.isConnected());
}

/* tx receipt object example (Byzantium) */
/*
{ tx: '0x907e6b14788aee3e9890e6ccadd2f8ad230def12fe15c10ddec0558630edd846',
  receipt:
   { transactionHash: '0x907e6b14788aee3e9890e6ccadd2f8ad230def12fe15c10ddec0558630edd846',
     transactionIndex: 0,
     blockHash: '0x89254fce2fb11cb606053bbf4f0bcad5887a57bc207d92498f74a8a62089e502',
     blockNumber: 3,
     gasUsed: 86751,
     cumulativeGasUsed: 86751,
     contractAddress: null,
     logs: [ [Object] ] },
  logs:
   [ { logIndex: 0,
       transactionIndex: 0,
       transactionHash: '0x907e6b14788aee3e9890e6ccadd2f8ad230def12fe15c10ddec0558630edd846',
       blockHash: '0x89254fce2fb11cb606053bbf4f0bcad5887a57bc207d92498f74a8a62089e502',
       blockNumber: 3,
       address: '0xeb0be9564d19df8d67c84ae9be41080ae37edc83',
       type: 'mined',
       event: 'SaleStarted',
       args: [Object] } ] }
*/