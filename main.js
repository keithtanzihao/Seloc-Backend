if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");
const mongodb = require("mongodb");
const mongoUtil = require("./mongoUtil");

const PORT_NUMBER = 3000;
const app = express();

app.use(express.json());
app.use(cors());

const ARTICLES = "articles";
const mongoURL = process.env.MONGO_URL;

async function main() {
  await mongoUtil.connectDB(process.env.MONGO_URL, "LetsTalk");

  app.post("/articles", async function (req, res) {
    try {
      let { 
        title, 
        summary, 
        description, 
        image, 
        avg_mood_score, 
        techniques,
        painpoints

      } = req.body;

      let techniqueArray = [];
      let painpointArray = [];

      let db = getDB();
      await db.collection(ARTICLES).insertOne({
        "title": title,
        "summary": summary,
        "description": description,
        "image": image,
        "avg_mood_score": avg_mood_score,
        "topic_techniques": techniques,
        "wellbeing_pain_points" : painpoints
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
    } catch (error) {
      res.status(500);
      res.json({
        message: "Internal Server Error, Please Contact Admin.",
      });
      console.log(e);
    }
  });
}

main();

app.listen(PORT_NUMBER, function () {
  console.log(`server has started at port ${PORT_NUMBER}`);
});
