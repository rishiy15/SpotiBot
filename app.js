let express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var apiaiApp = require('apiai')('5b6a68b93f784e83b745ba07b0d42516');

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

let isFirstTime = true;

// Server index page
app.get("/", function (req, res) {
    res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    console.log(req.body);
    // Make sure this is a page subscription
    if (req.body.object === "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function(entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                 if(event.message && event.message.text){
                    //sendMessage(event);
                    sendGreeting(event.sender.id,event.message.text);
                }
            });
        });

        res.sendStatus(200).end();
    }
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting
        request({
            url: "https://graph.facebook.com/v2.9/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function(error, response, body) {
            var greeting = "";
            if (error) {
                console.log("Error getting user's name: " +  error);
            } else {
                var bodyObj = JSON.parse(body);
                name = bodyObj.first_name;
                greeting = "Hi " + name + ". ";
            }
            var message = greeting + "My name is Spotibot. I can tell you a lot about musical artists. Who do you want to know about?";
            sendGreeting(senderId, {text: message});
        });
    }
}

function sendGreeting(recipientId, message){
    let msg = "HELLO";
    request({
        url: "https://graph.facebook.com/v2.9/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: msg,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
}

// sends message to user using api.ai's api
function sendMessage(event) {
    let sender = event.sender.id;
    let text = event.message.text;

    let apiai = apiaiApp.textRequest(text, {
        sessionId: 'talk_spotify'
    });

    apiai.on('response', (response)=>{
        let aiText = response.fulfillment.speech;

        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: sender},
                message: {message : aiText}
            }
        }, (error, response) => {
            if (error) {
                console.log("Error sending message: " + response.error);
            } else if (response.body.error){
                console.log('Error: ', response.body.error);
            }
        });
    });

    apiai.on('error',(error)=> {
        console.log(error);
    });

    apiai.end();

}

    // app.post('/ai', (req, res)=>{
    //     if(req.body.result.action === 'artist'){
    //         //call music artist api
    //         request({
    //             url: "https://graph.facebook.com/v2.6/me/messages",
    //             qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
    //             method: "POST",
    //             json: {
    //                 recipient: {id: recipientId},
    //                 message: {message : "ACTION RECEIVED"}
    //             }
    //         }, function(error, response, body) {
    //             if (error) {
    //                 console.log("Error sending message: " + response.error);
    //             }
    //         });
    //     }
    // });




// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
