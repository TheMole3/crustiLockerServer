const storage = require('node-persist');
const axios = require('axios');
const zlib = require('zlib')

let pushbullet = require("./pushbullet");
pushbullet = new pushbullet();

const price = require('./price.json')

class nordigen 
{
    constructor(secret_id, secret_key) 
    {
        this.secret_id = secret_id;
        this.secret_key = secret_key;

        this.init();
    }

    async init()
    {
        await storage.init({
            dir: 'persist',
        
            stringify: JSON.stringify,
        
            parse: JSON.parse,
        
            encoding: 'utf8',
        
            logging: false,  // can also be custom logging function
        
            ttl: false, // ttl* [NEW], can be true for 24h default or a number in MILLISECONDS or a valid Javascript Date object
        
            expiredInterval: 2 * 60 * 1000, // every 2 minutes the process will clean-up the expired cache
        
            // in some cases, you (or some other service) might add non-valid storage files to your
            // storage dir, i.e. Google Drive, make this true if you'd like to ignore these files and not throw an error
            forgiveParseErrors: false
        
        });
    }

    // Get a new access and refresh token from nordigen
    async getTokens()
    {
        return new Promise((resolve, reject) => {
            axios({
                method: 'POST',
                url: 'https://ob.nordigen.com/api/v2/token/new/',
                responseType: 'arraybuffer',
                decompress: true,
                data: {
                    "secret_id": this.secret_id,
                    "secret_key": this.secret_key
                },
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            })
            .then((response) => {
                zlib.gunzip(response.data, async function (_err, output) {
                    output = JSON.parse( output.toString() );

                    await storage.setItem("access", output.access);
                    await storage.setItem("refresh", output.refresh);

                    resolve(output);
                })
            })
            .catch((err) => {
                reject(err);
            })
        })
    }

    refreshToken()
    {
        return new Promise(async (resolve, reject) => {
            axios({
                method: 'post',
                url: 'https://ob.nordigen.com/api/v2/token/refresh/',
                responseType: 'arraybuffer',
                decompress: true,
                data: {
                    "refresh": await storage.getItem("refresh")
                },
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            })
            .then((response) => {
                zlib.gunzip(response.data, async function (_err, output) {
                    output = JSON.parse( output.toString() );

                    await storage.setItem("access", output.access);

                    resolve(output.access);
                })
            })
            .catch(async (err) => {
                // If the token is expired
                if(err.response.status == 401 || err.response.status == 400) {
                    this.getTokens()
                    .then((tokens) => {
                        resolve(tokens.access);
                    })
                    .catch(err => reject(err))

                } else reject(err);

            })
        })
    }

    // Create a new requisition link
    buildRequsitionLink()
    {
        return new Promise(async (resolve, reject) => {
            axios({
                method: 'POST',
                url: 'https://ob.nordigen.com/api/v2/requisitions/',
                data: {
                    redirect: "https://media.istockphoto.com/id/1383831579/vector/double-thumbs-up-emoticon.jpg?s=612x612&w=0&k=20&c=gk_PkPyFLeQCB69U8vhxmzlyikncetntRGfRghJTEiM=",
                    institution_id: process.env.INSTITUTION_ID
                },
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + await storage.getItem("access")
                },
            })
            .then(async (response) => {
                await storage.setItem("requsitionID", response.data.id);

                pushbullet.push("Requsition link", response.data.link)
                resolve({
                    link: response.data.link,
                    id: response.data.id
                });
            })
            .catch(async (err) => {
                // If the token is expired
                if(err.status == 401) {
                    this.refreshToken()
                    .then(() => {
                        resolve(this.buildRequsitionLink().catch(err => reject(err)));
                    })
                    .catch(err => reject(err))

                } else reject(err);

            })
        })
    }

    getTransactions()
    {
        return new Promise(async (resolve, reject) => {
            axios({
                method: 'GET',
                url: `https://ob.nordigen.com/api/v2/accounts/${process.env.ACCOUNT_ID}/transactions`,
                responseType: 'arraybuffer',
                decompress: true,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + await storage.getItem("access")
                },
            })
            .then(async (response) => {
                zlib.gunzip(response.data, async function (_err, output) {
                    output = JSON.parse(output.toString())
                    let sliced = output.transactions.booked.slice(0, 20);
                    let filtred = sliced.filter((i,n) => {
                        return (i["transactionAmount"]["amount"] == price.price) && (i["remittanceInformationStructured"] == price.match)
                    });

                    resolve(filtred);
                })
            })
            .catch(async (err) => {
                if(err.toJSON().status == 401) {
                    this.refreshToken()
                    .then(async (tokens) => {
                        resolve(this.getTransactions().catch(err => reject(err)));
                    })
                    .catch(err => reject(err))

                } else reject(err);

            })
        })
    }
}

module.exports = nordigen;