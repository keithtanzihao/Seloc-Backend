// Bring in the mongoclient
const mongodb = require("mongodb");

let database;

async function connectDB(dbURL, dbName) {
    try {
        const client = await mongodb.MongoClient.connect(dbURL, {
            useUnifiedTopology: true,
            useNewUrlParser: true,
        })
        client.db("admin").command({ ping: 1 });
        database = client.db(dbName);
        console.log("database connected")
    } catch(error) {
        console.log(error);
    }
}

function getDB() {
    return database;
}

module.exports = {
    connectDB, getDB
}