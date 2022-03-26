if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");
const mongodb = require("mongodb");
const bcrypt = require("bcrypt");
const expressSession = require("express-session");
const joi = require("joi");
const passport = require("passport");
const passportLocal = require("passport-local");

// Testing purposes
const util = require("util");

const mongoUtil = require("./mongoUtil");
const mongoErrors = require("./mongoErrors");

const PORT_NUMBER = process.env.PORT || 3001;
const app = express();

app.use(express.json());
app.use(cors());

// ---------------------- For login sessions ----------------------
// app.use(expressSession({ secret: "letsTalk" }));

const ARTICLES = "articles";
const TECHNIQUES = "techniques";
const USERS = "users";
const REVIEWS = "reviews";
const mongoURL = process.env.MONGO_URL;

const REGEX = {
  // Need to change url regex later copied from somewhere
  urls: new RegExp(
    /^[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/
  ),
  email: new RegExp(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  ),
};

/**
 * NOTES:
 * 1) Validation currently will be kept at a bare minimum
 */

async function main() {
  await mongoUtil.connectDB(process.env.MONGO_URL, "LetsTalk");

  //  -------------------------------------------- HELPER FUNCTIONS --------------------------------------------
  function responseMessage(statusCode, res, reqBody) {
    res.status(statusCode);
    res.json(reqBody);
  }

  // ---------------------- SANITIZING ----------------------
  app.get("/", function (req, res) {
    res.send("SERVER IS RUNNING");

    /**
     * Filtering technique is working
     */

    buildTechniqueQuery({
      // title: "Swimming",
      // category: "Exercise",
      // benefits: "Helps with losing weight and feeling better overall",
      // instructions: "5 laps of breaststroke",
      // painpoints: ["Lifestyle", "Focus", "Physical Health"]
      painpoints: ["Focus"],
    }, true);
  });

  //  ---------------------- Articles ----------------------
  app.post("/articles", async function (req, res) {
    let unDeclaredFields = {
      createDate: new Date(),
      lastUpdated: new Date(),
      avgScore: 0,
      reviewsList: [],
    };

    // signup post request validation
    const articlesSchema = joi
      .object({
        title: joi.string().alphanum().required(),
        summary: joi.string().required(),
        description: joi.string().required(),
        image: joi.string().pattern(REGEX.urls),
        techniqueList: joi.array(),
      })
      .required();
    const { error } = articlesSchema.validate(req.body);

    if (error) throw new mongoErrors(error, 400);

    await mongoUtil
      .getDB()
      .collection(ARTICLES)
      .insertOne({
        ...req.body,
        ...unDeclaredFields,
      });
    res.json({
      "Articles post": { ...req.body, ...unDeclaredFields },
    });
  });

  app.get("/articles", async function (req, res) {
    let articleArrays = await mongoUtil
      .getDB()
      .collection(ARTICLES)
      .find()
      .toArray();
    res.json({
      articles: articleArrays,
    });
  });

  app.put("/articles/:id", async function (req, res) {
    // Might need to add a try catch here
    try {
      let {
        title,
        summary,
        description,
        create_date,
        image,
        techniques,
        painpoints,
      } = req.body;

      // Need to change this to alway be automatically generated
      let updatedDate = new Date(create_date);

      // console.log(req.body);
      let db = mongoUtil.getDB();
      let reviewsArray = [];
      let techniqueArray = techniques;
      let painpointArray = painpoints;

      let result = await db.collection(ARTICLES).updateOne(
        {
          _id: mongodb.ObjectId(req.params.id),
        },
        {
          $set: {
            ...req.body,
            last_updated: updatedDate,
            topic_technique: techniqueArray,
            wellbeing_pain_pt: painpointArray,
          },
        }
      );
      console.log(result);
      res.status(200);
      res.json({
        message: "Result acheived",
      });
    } catch (error) {
      console.log(error);
    }
  });

  app.delete("/articles/:id", async function (req, res) {
    await mongoUtil
      .getDB()
      .collection(ARTICLES)
      .deleteOne({
        _id: mongodb.ObjectId(req.params.id),
      });
    res.status(200);
    res.json({
      message: "The document has been delete",
    });
  });

  //  -------------------------------------------- TECHNIQUES --------------------------------------------

  // filter technique function
  async function buildTechniqueQuery(reqBody, isSearch = false) {
    let { searchQuery, category, painpoints } = reqBody;

    let queryOrArray = [];
    let query = {};
    let regex = new RegExp(searchQuery, "i");

    if (isSearch) {
      if (searchQuery) {
        query = { $or: queryOrArray }
        queryOrArray.push({ title: { $regex: searchQuery, $options: "i" } });
        queryOrArray.push({ category: { $in: [regex] } })
        queryOrArray.push({ benefits: { $in: [regex] } })
        queryOrArray.push({ instructions: { $in: [regex] } })
        queryOrArray.push({ painpoints: { $in: [regex] } })
      }
    }

    if (category) query.category = { $all: [...category] }
    if (painpoints) query.painpoints = { $all: [...painpoints] }

    console.log(util.inspect(query, { showHidden: false, depth: null, colors: true }));

    // Need to place await in front of buildTechniqueQuery you pepeg
    return mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .find(query, {})
      .toArray();
  }


  // For technique search bar
  app.post("/techniques/search", async function (req, res) {

    console.log(req.body);

    // Fields need not be required
    const techniqueSearchSchema = joi.object({
      searchQuery: joi.string(),
      category: joi.array(),
      painpoints: joi.array(),
    }).required();

    const { error } = techniqueSearchSchema.validate(req.body);
    if (error) throw new mongoErrors(error, 400);

    let query = await buildTechniqueQuery(req.body, true);
    console.log("----------query----------");
    console.log(query);
    responseMessage(200, res, query);
  });



  // Generic get request to retrieve technique from DB
  app.get("/techniques", async function (req, res) {
    let techniqueArrays = await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .find()
      .toArray();
    responseMessage(200, res, techniqueArrays);
  });



  // Generic post request to add a new technique to DB
  app.post("/technique", async function (req, res) {
    // techniques post request validation
    const techniqueSchema = joi
      .object({
        title: joi.string().required(),
        category: joi.array().min(1).required(),
        benefits: joi.array().min(1).required(),
        instructions: joi.array().min(1).required(),
        painpoints: joi.array().min(1).required(),
      })
      .required();
    const { error } = techniqueSchema.validate(req.body);
    if (error) throw new mongoErrors(error, 400);

    await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .insertOne({
        ...req.body,
      });
    responseMessage(200, res, req.body);
  });



  // Route to modify an existing technique
  app.put("/technique/:id", async function (req, res) {
    // techniques put request validation
    const techniqueSchema = joi
      .object({
        title: joi.string().required(),
        category: joi.array().min(1).required(),
        benefits: joi.array().min(1).required(),
        instructions: joi.array().min(1).required(),
        painpoints: joi.array().min(1).required(),
      })
      .required();
    const { error } = techniqueSchema.validate(req.body);
    if (error) throw new mongoErrors(error, 400);

    await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .updateOne({
        _id: mongodb.ObjectId(req.params.id)
      }, {
        $set: { ...req.body }
      });
    responseMessage(200, res, req.body);
  });



  app.delete("/technique/:id", async function (req, res) {
    // techniques delete request validation
    console.log(req.params.id, typeof req.params.id);
    const techniqueSchema = joi
      .object({
        id: joi.string().length(24).required(),
      })
      .required();
    const { error } = techniqueSchema.validate(req.params);
    if (error) throw new mongoErrors(error, 400);

    await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .deleteOne({
        _id: mongodb.ObjectId(req.params.id),
      });
    responseMessage(200, res, req.params);
  });





  //  -------------------------------------------- LOGIN --------------------------------------------
  app.post("/login", async function (req, res) {
    // login post request validation
    const loginSchema = joi
      .object({
        email: joi.string().pattern(REGEX.email),
        password: joi.string().min(8).required(),
      })
      .required();
    const { error } = loginSchema.validate(req.body);

    // if user does not exist
    const userInfo = await mongoUtil.getDB().collection(USERS).findOne({
      email: req.body.email,
      password: req.body.password,
    });

    if (error) throw new mongoErrors(error, 400);
    if (!userInfo) throw new mongoErrors("User does not exist", 400);

    res.status(200);
    res.json({
      "Login post": userInfo,
    });
  });

  //  -------------------------------------------- SIGNUP --------------------------------------------
  app.post("/signup", async function (req, res) {
    // signup post request validation
    const signupSchema = joi
      .object({
        firstName: joi.string().alphanum().min(3).required(),
        lastName: joi.string().alphanum().min(3).required(),
        email: joi.string().pattern(REGEX.email),
        password: joi.string().min(8).required(),
        profileImage: joi.string(),
      })
      .required();
    const { error } = signupSchema.validate(req.body);

    // if email exist already
    const userInfo = await mongoUtil.getDB().collection(USERS).findOne({
      email: req.body.email,
    });

    // Throwing errors
    if (error) throw new mongoErrors(error, 400);
    if (userInfo) throw new mongoErrors("User exist", 400);

    await mongoUtil
      .getDB()
      .collection(USERS)
      .insertOne({
        ...req.body,
      });

    res.status(200);
    res.json({
      "Signup post": req.body,
    });
  });

  //  -------------------------------------------- USER EDIT --------------------------------------------
  app.put("/users/:id", async function (req, res) {
    let { firstName, lastName, email, username, password, profileImage } =
      req.body;

    console.log("testing");
    // signup post request validation
    const userSchema = joi
      .object({
        firstName: joi.string().alphanum().min(3).required(),
        lastName: joi.string().alphanum().min(3).required(),
        email: joi.string().pattern(REGEX.email),
        password: joi.string().min(8).required(),
        profileImage: joi.string(),
      })
      .required();
    const { error } = userSchema.validate(req.body);

    // req.body validation testing
    if (error) throw new mongoErrors(error, 400);

    await mongoUtil
      .getDB()
      .collection(USERS)
      .updateOne(
        {
          _id: mongodb.ObjectId(req.params.id),
        },
        {
          $set: {
            ...req.body,
          },
        }
      );
    res.status(200);
    res.json({
      "User put": `This is the NEW USER ${req.body}`,
    });
  });

  //  -------------------------------------------- USER DELETE --------------------------------------------
  app.delete("/users/:id", async function (req, res) {
    await mongoUtil
      .getDB()
      .collection(USERS)
      .deleteOne({
        _id: mongodb.ObjectId(req.params.id),
      });
    res.status(200);
    res.json({
      "User delete": `This is the deleted body: ${req.body}`,
    });
  });
}


main();

app.listen(PORT_NUMBER, function () {
  console.log(`server has started at port ${PORT_NUMBER}`);
});




/*
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
THINGS TO DO LATER (KIV) YOU PEPEG
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

1) User auth / authentication



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
THINGS RECENTLY FINISHED KEKL
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

1) Newly implemented technique routes
    - Search is completed (Frontend)
    - Category, painpoints filter completed (Need to merge with search frontend)

*/
