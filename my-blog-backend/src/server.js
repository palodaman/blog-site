import fs from 'fs';
import admin from 'firebase-admin';
import express from 'express';
import {MongoClient, ObjectId} from 'mongodb';
import {db, connectToDb} from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); //recreating teh __dirname when the type is not equal to module in json file
const __dirname = path.dirname(__filename);
// let articlesInfo= [
//     name: "learn-react",
//     upvotes: 0,
//     comments: [],
// }, {
//     name: "learn-node",
//     upvotes: 0,
//     comments: [],
// }, {
//     name: "mongodb",
//     upvotes: 0,
//     comment: [],
// }]

//setup firebase admin package on node server before create the express app
const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);

//telling firebaase admin package what credentials to use to connect to our project
admin.initializeApp({
    credential: admin.credential.cert(credentials),
});

//calls the express as a function which will create a new express app
const app = express();
//now we have the app object and can define different end points and what we want our server to do when one of those endpoints
//receives a request

//type of request is get: will take the path and a callback that gets called whenever this end[oin] receives a request
//the callbacks takes 2 arguements, the first one is a request object which contains detials about the request received
//the second one is a response object which we can use to send a response back to whoever sent the request
// app.get('/hello',(req, res) =>{
//     res.send('Hello!');
//     //send the response
// })

app.use(express.json());
app.use(express.static(path.join(__dirname, '../build'))); //tell express to use that build folder as a static folder //path : ../build

//add a route handler for specifically when we receive a request not for our api routes
app.get(/^(?!\/api).+/, (req, res) =>{
    res.sendFile(path.join(__dirname, '../build/index.html'));
}) //use regex for allt he routes that dont start with api


//use ecpress middleware to autoimatically load the user's info whenver we receive a request
app.use(async (req, res, next) =>{ //next is a callback function : call it when we done processing things in the middleware
    const {authtoken} = req.headers; //get the authtoken that the client side included in the headers

    if(authtoken){
        try{
            //use firebase auth to take the authtoken and load the corresponding user
            req.user = await admin.auth().verifyIdToken(authtoken);
        }catch (e){
            return res.sendStatus(400); //will return and go to the next function;
        }
      
    }
    
    //provide a default value for a user if the auth token wasnt includede and the user still makes the request
    req.user = req.user || {};

    next(); //in order to make sure that program execution moves on the route handling below, we call back the next function;
    
});


//when express receives a request that has a json body/json payload, it's going to parse that and make it automatically available
//to us on request.body


app.get('/api/articles/:name', async (req, res)=>{
    const { name } = req.params;
    // const client = new MongoClient('mongodb://127.0.0.1:27017');
    // await client.connect(); //this is asynchronous, aslking the client to connect 
    
    const { uid } = req.user; //get the id from the user loaded above known as uid on firebase 

    // //at this point we have a connection to our mongo database, now we need to get the specific database that we created earlier
    // const db = client.db('react-blog-db'); //same as use react-blog-db in shell
    // // console.log(await db.collection('articles').findOne({name}));
    // //now that we have the reference to the db, we can make a query to load the article

    const article = await db.collection('articles').findOne({name}); //articels is the collection created earlier in shell
    if(article){
        const upvoteIds = article.upvoteIds || []; //checking the property if it is populated
        article.canUpvote = uid && !upvoteIds.includes(uid); //can only upvote if... //adding a property to the article

        res.json(article); //send the article to the client in json data
    }else{
        res.sendStatus(404); //.send('Article not found')
    }
    // const article = await db.collection('articles').findOne({name, _id: ObjectId(upvotes)}); //articels is the collection created earlier in shell
    //find one function allows to look for a single document inside a mongodb collection (generally used with unique keys)
});

//add another piece of middleware that will only apply to upvote and add comment endpoint to check if the user is logged in
app.use((req, res, next) =>{
    if(req.user){ //if the user exists and has included the auth token in the request
        next(); //send to following response handlers
    }else{
        res.sendStatus(401); //the user isnt allowewd to access to that resource
    }
})


//upvote endpoint
app.put('/api/articles/:name/upvote', async (req, res) =>{
    const {name} = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({name}); //articels is the collection created earlier in shell
    
    if(article){
        const upvoteIds = article.upvoteIds || []; //checking the property if it is populated
        const canUpvote = uid && !upvoteIds.includes(uid); //can only upvote if... //adding a property to the article

        if(canUpvote){
            await db.collection('articles').updateOne({name}, {
                $inc : {upvotes: 1}, //inc stands for increment
                $push : {upvoteIds: uid}
              //$set : {upvotes: 100} will set the upvotes to 100
            });
        }

            //LOAD THE articel to sendf back to the client with the upadted info
        const updatedArticle = await db.collection('articles').findOne({name})

        res.json(updatedArticle);
    } else{
            res.send('The article doesn\' exist');
    }
});

//endpoit to add comments
app.post('/api/articles/:name/comments', async (req, res) =>{
    const {postedBy, text} = req.body; //get the name and comment from the payload
    const {name} = req.params; //get the name of the article from the url parameter
    const {email} = req.user; ///get the users email to check if they have logged in
   
     await db.collection('articles').updateOne({name}, {
        $push: {comments: { postedBy: email, text}},
     })

     const article = await db.collection('articles').findOne({name});

    if(article){
        res.json(article);
    }else{
        res.send('The articel doesn\' exist');
    }
   
})

//runtime would be abele to tell what port it should listen on
const PORT = process.env.PORT || 8000 //for development mode

connectToDb( () => {
    console.log("successfully connected to db")
    //tell our server to listen, takes an arguement for which port to listen on, and a callback for just logging a message generally
    app.listen(PORT, ()=>{
    console.log('Server is listening on port ' + PORT)
});
})
