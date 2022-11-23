import {MongoClient} from 'mongodb';
let db;

async function connectToDb(cb){ //cb = callback
    const client= new MongoClient('mongodb://127.0.0.1:27017') //27017 is the default port for mongo db
    await client.connect() //to connect with client

    //get a reference to the db we are working with
    db= client.db('react-blog-db'); //write the query now
    cb(); //need to call cb after all of this is done
}

export {
    db, 
    connectToDb
};