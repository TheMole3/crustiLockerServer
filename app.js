require('dotenv').config()

const express = require('express')
const app = express();
const http = require('http').Server(app);

const cors = require('cors');
app.use(cors());
app.use(express.json())

let nordigen = require("./nordigen");
nordigen = new nordigen(process.env.SECRET_ID, process.env.SECRET_KEY);

http.listen(process.env.PORT, () => {
    console.log("Listening on port *" + process.env.PORT)
})

function verifyToken(req, res, next) {
    const bearerHeader = req.headers["authorization"]
    if(typeof bearerHeader !== 'undefined') {

        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];

        if(bearerToken == process.env.TOKEN) {
            next();
        } else {
            res.sendStatus(401);
        }        

    } else {
        res.sendStatus(403);
    }
}

app.get("/transactions", verifyToken, (req, res) => {
    nordigen.getTransactions()
    .then(transactions => {
        res.send(transactions);
    })
    .catch(err => {
        res.status(err.toJSON().status).send(err);
    })
})

app.get("/sendRequisition", verifyToken, (req, res) => {
    nordigen.buildRequsitionLink()
    .then(data => {
        res.send(data.link);
    }).catch(err => {
        res.status(err.toJSON().status).send(err);
    })
})