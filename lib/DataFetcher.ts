/*
*   This class will fetch data from te given URLs
*   For now, we only work with data from the Obelisk API (City of Things)
*   To fetch this data we have to authorize ourselves etc..
*   normally it should be possible to just provide the URL to retrieve the data
* */
const request = require('request');
const Configuration = require('../lib/Configuration');

class DataFetcher {

    private URLs: string[];
    private access_token: string;
    private refresh_token: string;

    constructor(urls: string[]){
        this.URLs = urls;
        this.authorize();
    }

    async authorize() {
        const tokens: any = await this.getRPTtoken();
        this.access_token = tokens.access_token;
        this.refresh_token = tokens.refresh_token;
        this.getAirQualityThings();
    }

    async refresh(){
        const tokens: any = await this.refreshRPTtoken();
        this.access_token = tokens.access_token;
        this.refresh_token = tokens.refresh_token;
    }

    async getAirQualityThings(){
        // 1. We have to fetch all the available Things
        let things: any = await new Promise(resolve => {
            request.get('https://idlab-iot.tengu.io/api/v1/scopes/cot.dencity/things', {
                headers : {
                    'Accept' : 'application/json',
                    'Authorization' : 'Bearer ' + this.access_token
                }
            }, (err, httpResponse, body) => {

                if(err){
                    console.log(err);
                }

                if(httpResponse.statusCode === 200){
                    resolve(JSON.parse(body));
                }

                if(httpResponse.statusCode === 401){    // TODO : is this allowed?
                    this.refresh();                     // TODO : make sure it's finished before next call
                    this.getAirQualityThings();
                }
            });
        });

        // 2. Filter out those Things that not measure air quality
        for(let index = 0 ; index < things.length ; index++){
            const thing = things[index].id;

            request.get('https://idlab-iot.tengu.io/api/v1/scopes/cot.dencity/things/' + thing + '/metrics', {
                headers : {
                    'Accept' : 'application/json',
                    'Authorization' : 'Bearer ' + this.access_token
                }
            }, (err, httpResponse, body) => {
                if(err) console.log(err);

                if(httpResponse.statusCode === 200){
                    const metrics = JSON.parse(body);
                    // TODO : iterate through metrics
                    /*for(let metric in metrics){

                    }*/
                }

                if(httpResponse.statusCode === 401){
                    this.refresh();
                    this.getAirQualityThings();
                }
            })
        }
    }



    async fetchData(url: string){
        /*
        *   1. Fetch all the 'things'
        *   2. Delete things that do not measure airquality
        *   3. For the remaining things, get the airquality data
        * */
        this.authorize();
        this.refresh();
    }

    /*
    *   In order to execute API calls we need to authorize ourselves
    *   We receive an access token and a refresh token
    *   When the access token has expired we need to use the refresh token to request a new access token
    * */
    private getRPTtoken(){
        const authString = new Buffer('linked-data-fragments-client:c9022447-3f57-425d-b1e9-a09c31d80f74').toString('base64');

        const tokens = new Promise(resolve => {
            request.post('https://idlab-iot.tengu.io/auth/realms/idlab-iot/protocol/openid-connect/token', {
                form: {
                    'grant_type' : 'urn:ietf:params:oauth:grant-type:uma-ticket',
                    'audience' : 'policy-enforcer'
                },
                headers: {
                    'Content-Type' : 'application/x-www-form-urlencoded',
                    'Authorization' : 'Basic ' + authString
                }
            }, (err, httpResponse, body) => {
                if(err) console.log(err);

                if(httpResponse.statusCode === 200){
                    const jsonBody = JSON.parse(body);
                    resolve({'access_token' : jsonBody.access_token, 'refresh_token' : jsonBody.refresh_token});
                }
            });
        });
        return tokens;
    }

    private refreshRPTtoken(){
        const authString = new Buffer('linked-data-fragments-client:c9022447-3f57-425d-b1e9-a09c31d80f74').toString('base64');

        const tokens = new Promise(resolve => {
           request.post('https://idlab-iot.tengu.io/auth/realms/idlab-iot/protocol/openid-connect/token', {
               form: {
                   'grant_type' : 'refresh_token',
                   'refresh_token' : this.refresh_token,
               },
               headers : {
                   'Content-Type' : 'application/x-www-form-urlencoded',
                   'Authorization' : 'Basic ' + authString
               }
           }, (err, httpResponse, body) => {
               if(err) console.log(err);

               if(httpResponse.statusCode === 200){
                   const jsonBody = JSON.parse(body);
                   resolve({'access_token' : jsonBody.access_token, 'refresh_token' : jsonBody.refresh_token});
               }

               if(httpResponse.statusCode === 400){
                   return this.authorize();
               }
           })
        });

        return tokens;
    }
}

module.exports = DataFetcher;
