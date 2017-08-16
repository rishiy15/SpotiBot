let express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var apiaiApp = require('apiai')(process.env.CLIENTAI_ACCESS_TOKEN);

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));


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
                if(event.postback){
                    processPostback(event);
                }else if(event.message && event.message.text){
                    //sendMessage(event);
                    sendMessage(event);
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
            method: 'GET'
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
            sendGreeting(senderId, message);
        });
    }
}

function sendGreeting(recipientId, message){
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: {text: message},
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
        let aiText = response.result.fulfillment.speech;

        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: sender},
                message: {text : aiText}
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

app.post('/ai', (req, res)=>{
    if(req.body.result.action === 'artist'){
        //call music artist api
        let artist = req.body.result.paramters['artist'];
        let baseUrl = "http://api.music-story.com/artist/search";
        return res.json({
            speech: 'ACTION RESPONSE',
            displayText: 'ACTION RESPONSE'
        });
        // request.get('http://api.music-story.com/artist/search',{
        //     oauth:{
        //         consumer_key: process.env.CONSUMER_KEY,
        //         consumer_secret: process.env.CONSUMER_SECRET,
        //         token: process.env.ACCESS_TOKEN,
        //         token_secret: process.env.TOKEN_SECRET
        //     },
        //     qs:{name: artist},
        //     json: true
        // }, function(error,res,body){
        //     if(!error && res.statusCode == 200){
        //         let jsonObj = JSON.parse(body);
        //         let artist_id = jsonObj.id;
        //         let msg = 'Artist id is ' + artist_id;
        //
        //         return res.json({
        //             speech: msg,
        //             displayText:msg,
        //             source: 'artist'
        //         });
        //
        //     }else{
        //         return res.status(400).json({
        //             status: {
        //                 code: 400,
        //                 errorType: 'Failed to look up artist name'
        //             }
        //         });
        //     }
        // })
    }
    return res.json({
        speech: 'ACTION RESPONSE',
        displayText: 'ACTION RESPONSE'
    });
});




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
