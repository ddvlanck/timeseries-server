var WebSocket = require('ws');
// Create websocket and connect to the server
var raw_ws = new WebSocket('ws://localhost:3001');
//const stats_ws = new WebSocket('ws://localhost:3002');
// When the client receives a message, print out the data
raw_ws.on('message', function (data) {
    console.log('Data received from the Raw Interface Websocket:');
    console.log('-----------------------------------------------');
    console.log(data.toString());
});
// When the client receives a message, print out the data
/*stats_ws.on('message', data => {
    console.log('Data received from the Statistical Interface Websocket:');
    console.log('---------------------------------------------------------');
    console.log(data.toString());
});*/ 
