const axios = require('axios');

class pushbullet {
    push(title, message) 
    {
        axios({
            method: 'POST',
            url: 'https://api.pushbullet.com/v2/pushes',

            data: {
                type: "note",
                title: title,
                body: message,
                channel_tag: process.env.PUSHBULLET_CHANNEL,
            },
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Access-Token": process.env.PUSHBULLET_TOKEN
            }
        })
        .catch((err) => console.error(err))
    }
}

module.exports = pushbullet;