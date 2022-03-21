if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");

const cors = require("cors");
const mongodb = require("mongodb");
const mongoUtil = require("./mongoUtil");
const { ObjectID } = require("bson");

const PORT_NUMBER = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(cors());

const ARTICLES = "articles";
const TECHNIQUES = "techniques"
const USERS = "users"
const REVIEWS = "reviews"
const mongoURL = process.env.MONGO_URL;

async function main() {
  await mongoUtil.connectDB(process.env.MONGO_URL, "LetsTalk");

  // ---------------------- SANITIZING ---------------------- 
  app.get("/", function(req, res) {
    res.send("SERVER IS RUNNING");
  })

  //  ---------------------- Articles ---------------------- 
  app.post("/articles", async function (req, res) {
    try {
      let { 
        title, 
        summary, 
        description, 
        create_date,
        image, 
        techniques,
        painpoints

      } = req.body;

      let createDate = new Date(create_date);
      let reviewsArray = [];
      let techniqueArray = techniques;
      let painpointArray = painpoints;

      let db = mongoUtil.getDB();
      
      // Comment out later
      function commetingOut() {
        // await db.collection(ARTICLES).insertOne({
        //   "title": title,
        //   "summary": summary,
        //   "description": description,
        //   "create_date": createDate,
        //   "last_updated": createDate,
        //   "image": image,
        //   "avg_mood_score": 0,
        //   "mood_reviews": reviewsArray,
        //   "topic_technique": techniqueArray,
        //   "wellbeing_pain_pt" : painpointArray
        // })
      }
      
      await db.collection(ARTICLES).insertOne({
        ...req.body,
        "create_date": createDate,
        "last_updated": createDate,
        "avg_mood_score": 0,
        "mood_reviews": reviewsArray,
        "topic_technique": techniqueArray,
        "wellbeing_pain_pt" : painpointArray
      })
      res.redirect('/articles');


    } catch (error) {
      console.log(error);
    }
  });

  app.get("/articles", async function (req, res) {
    try {
      const db = mongoUtil.getDB();
      let articleArrays = await db.collection(ARTICLES).find().toArray();
      res.json({
        articles: articleArrays,
      });

      // console.log(articleArrays);

    } catch (error) {
      res.status(500);
      res.json({
        message: "Internal Server Error, Please Contact Admin.",
      });
      console.log(e);
    }
  });

  app.put("/articles/:id", async function(req, res) {
    // Might need to add a try catch here
    try {
      let { 
        title, 
        summary, 
        description, 
        create_date,
        image, 
        techniques,
        painpoints
      } = req.body;
  
      // Need to change this to alway be automatically generated
      let updatedDate = new Date(create_date);

      // console.log(req.body);
      let db = mongoUtil.getDB();
      let reviewsArray = [];
      let techniqueArray = techniques;
      let painpointArray = painpoints;

      let result = await db.collection(ARTICLES).updateOne({
        "_id": mongodb.ObjectId(req.params.id)
      },{
        "$set": {
          ...req.body,
          "last_updated": updatedDate,
          "topic_technique": techniqueArray,
          "wellbeing_pain_pt" : painpointArray
        }
      });
      console.log(result);
      res.status(200);
      res.json({
        "message": "Result acheived",
      });
    } catch(error) {
      console.log(error);
    }
  })

  app.delete("/articles/:id", async function(req, res) {
    await mongoUtil.getDB().collection(ARTICLES).deleteOne({
      "_id": mongodb.ObjectId(req.params.id)
    })
    res.status(200);
    res.json({
      "message": "The document has been delete"
    })
  })

  //  ---------------------- Techniques ---------------------- 
  app.post("/techniques", async function(req, res) {
    try {
      await mongoUtil.getDB().collection(TECHNIQUES).insertOne({
        ...req.body
      })
      res.status(200);
      res.json({
        'message': req.body
      })

    } catch(error) {
      console.log(error);
    }
  })

  app.get("/techniques", async function(req, res) {
    try {
      let techniqueArrays = await mongoUtil.getDB().collection(TECHNIQUES).find().toArray();
      res.json({
        articles: techniqueArrays,
      });
    } catch(error) {
      console.log(error);
    }
  })

  app.put("/techniques/:id", async function(req, res) {
    try {
      await mongoUtil.getDB().collection(TECHNIQUES).updateOne({
        "_id": mongodb.ObjectId(req.params.id)
      }, {
        "$set": {
          "benefits": req.body.benefits,
          "name": req.body.name,
          "category": req.body.category,
          "instructions": req.body.instructions
        }
      })
      res.status(200);
      res.json({
        'message': `This is the updated body: ${req.body}`
      })
    } catch(error) {
      console.log(error);
    }
  })

  app.delete("/techniques/:id", async function(req, res) {
    try {
      await mongoUtil.getDB().collection(TECHNIQUES).deleteOne({
        "_id": mongodb.ObjectId(req.params.id)
      })
      res.status(200);
      res.json({
        'message': `This is the deleted body: ${req.body}`
      })
    } catch(error) {
      console.log(error);
    }
  })

  //  ---------------------- USERS ---------------------- 
  app.post("/users", async function(req, res) {
    try {
      await mongoUtil.getDB().collection(USERS).insertOne({
        ...req.body
      })
      res.status(200);
      res.json({
        'ADDED NEW USER': req.body
      })
    } catch(error) {
      console.log(error);
    }
  })
  
  app.get("/users", async function(req, res) {
    try {
      let userArray = await mongoUtil.getDB().collection(USERS).find().toArray();
      res.json({
        "users": userArray
      })
    } catch(error) {
      console.log(error);
    }
  })

  app.put("/users/:id", async function(req, res) {
    try {
      let {
        first_name,
        last_name,
        email,
        username,
        password,
        profile_image

      } = req.body;

      await mongoUtil.getDB().collection(USERS).updateOne({
        "_id": mongodb.ObjectId(req.params.id)
      }, {
        "$set": {
          "first_name": first_name,
          "last_name": last_name,
          "email": email,
          "username": username,
          "password": password,
          "profile_image": profile_image
        }
      }) 
      res.status(200);
      res.json({
        "NEW USER": `This is the NEW USER ${req.body}`
      })

    } catch(error) {
      console.log(error);
    }
  })

  app.delete("/users/:id", async function(req, res) {
    try {
      await mongoUtil.getDB().collection(USERS).deleteOne({
        "_id": mongodb.ObjectId(req.params.id)
      })
      res.status(200);
      res.json({
        'USER DELETE': `This is the deleted body: ${req.body}`
      })
    } catch(error) {
      console.log(error);
    }
  })
}

main();

app.listen(PORT_NUMBER, function () {
  console.log(`server has started at port ${PORT_NUMBER}`);
});



