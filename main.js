if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");

// Need to merge tgt
const mongodb = require("mongodb");
const { project, projection } = require("mongodb");
const mongoUtil = require("./mongoUtil");
const mongoErrors = require("./mongoErrors");
const util = require("util");
const joi = require("joi");

const PORT_NUMBER = process.env.PORT || 3001;
const app = express();

////////////////////////////////////////////////////////////////////////////////////
//            EXPERIMENTAL STUFF  WILL FUCK UP HERE CFM PLUS CHOP                 //
////////////////////////////////////////////////////////////////////////////////////

const bcrypt = require("bcrypt");
const expressSession = require("express-session");
const passport = require("passport");
const passportLocal = require("passport-local");


app.use(expressSession({
  secret: "badsecret",
  // If not commented out under developer tools/applications cookies will not exist
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false
  }
}))

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

app.use(express.json());
app.use(cors({
  credentials: true
}));


const TECHNIQUES = "techniques";
const COMMENTS = "comments";
const USERS = "users";
const mongoURL = process.env.MONGO_URL;

const REGEX = {
  // Need to change url regex later copied from somewhere
  urls: new RegExp(/^[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/),
  email: new RegExp(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/),
};

async function main() {
  await mongoUtil.connectDB(process.env.MONGO_URL, "LetsTalk");

  // HELPER FUNCTIONS 
  function responseMessage(statusCode, res, reqBody) {
    res.status(statusCode);
    res.json(reqBody);
  }

  // CHECK IF BACKEND WORKS
  app.get("/", function (req, res) {
    res.send("SERVER IS RUNNING");
  });


  // Route to check if user email exist within DB
  app.get("/register/:email", async function (req, res, next) {
    const emailSchema = joi
      .object({
        email: joi.string().pattern(REGEX.email)
      })
      .required();
    const { error } = emailSchema.validate(req.params);

    if (error) {
      next(new mongoErrors(error.details[0].message, 400));

    } else {
      const emailInfo = await mongoUtil.getDB().collection(USERS).findOne({
        email: req.params.email
      }, {
        _id: 0,
        email: 1
      });

      // Storing user info into session / cookie
      if (emailInfo) expressSession.user_email = req.params.email;
      responseMessage(200, res, emailInfo);
    }
  })


  // Register user into db
  app.post("/register", async function (req, res, next) {
    // signup post request validation
    const signupSchema = joi
      .object({
        firstName: joi.string().alphanum().min(3).required(),
        lastName: joi.string().alphanum().min(3).required(),
        email: joi.string().pattern(REGEX.email).required(),
        password: joi.string().min(8).required(),
        profileImage: joi.string().allow("")
      })
      .required();

    const { error } = signupSchema.validate(req.body);

    if (error) {
      next(new mongoErrors(error.details[0].message, 400));

    } else {
      const userInfo = await mongoUtil.getDB().collection(USERS).findOne({
        email: req.body.email,
      });

      // if email exist already
      if (userInfo) {
        next(new mongoErrors("Email already exist", 400));
      } else {
        // Hashing user password
        const passwordSalt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(req.body.password, passwordSalt);
        req.body.password = passwordHash;

        await mongoUtil
          .getDB()
          .collection(USERS)
          .insertOne({
            ...req.body,
          });
        responseMessage(200, res, req.body);
      }
    }
  });

  // Need to double check this later------------------------------------------------------------------------------------
  app.get("/login/:email/:password", async function (req, res) {

    // login post request validation
    const loginSchema = joi
      .object({
        email: joi.string().pattern(REGEX.email),
        password: joi.string().min(8).required(),
      })
      .required();
    const { error } = loginSchema.validate(req.params);

    // if user does not exist
    const userInfo = await mongoUtil.getDB().collection(USERS).findOne({
      email: req.params.email,
    });

    if (error) throw new mongoErrors(error, 400);
    // if (!userInfo) throw new mongoErrors("User does not exist", 400);

    let isValidPassword = false;
    if (userInfo) {
      isValidPassword = await bcrypt.compare(req.params.password, userInfo.password);
      expressSession.user_email = userInfo.email;
    }

    responseMessage(200, res, {
      sessionUser: expressSession.user_email,
      isValidPassword: isValidPassword
    });
  });


  // Logout Route (not in use) ------------------------------------------------------------------------------------
  app.get("/logout", function (req, res) {
    expressSession.user_email = null;
  })


  // TECHNIQUES

  // Filter technique function
  async function buildTechniqueQuery(reqBody, isSearch = false) {
    let { searchQuery, category, painpoints, filterOptions } = reqBody;

    let queryAndArray = [];
    let queryOrArray = [];

    let query = {};
    let regex = new RegExp(searchQuery, "i");

    if (isSearch) {

      // WIll refactor this later if ive got time
      query = { $and: queryAndArray };
      queryAndArray.push({ $or: queryOrArray });

      if (searchQuery) {
        queryOrArray.push({ title: { $regex: searchQuery, $options: "i" } });
        queryOrArray.push({ description: { $regex: searchQuery, $options: "i" } });
        queryOrArray.push({ 'instructions.content': { $regex: searchQuery, $options: "i" } })
        queryOrArray.push({ 'benefits.content': { $regex: searchQuery, $options: "i" } })
      }

      if (filterOptions.difficulty && filterOptions.difficulty !== "None") {
        queryAndArray.push({ difficulty: { $regex: filterOptions.difficulty, $options: "i" } });
      }

      if (filterOptions.selectedCategory && filterOptions.selectedCategory.length !== 0) {
        if (filterOptions.isBroadMatch) {
          queryAndArray.push({ category: { $all: filterOptions.selectedCategory } });
        } else {
          queryAndArray.push({ category: { $in: filterOptions.selectedCategory } });
        }
      }

      if (filterOptions.selectedPainPoints && filterOptions.selectedPainPoints.length !== 0) {
        if (filterOptions.isBroadMatch) {
          queryAndArray.push({ painpoints: { $all: filterOptions.selectedPainPoints } });
        } else {
          queryAndArray.push({ painpoints: { $in: filterOptions.selectedPainPoints } });
        }
      }
    }

    // Need to zhng this asap
    if (filterOptions.orderBy && filterOptions.orderBy !== "None") {
      if (filterOptions.orderBy === "Ascending") {
        return mongoUtil
          .getDB()
          .collection(TECHNIQUES)
          .find(query, {})
          .sort({ duration: 1 })
          .toArray();
      } else {
        return mongoUtil
          .getDB()
          .collection(TECHNIQUES)
          .find(query, {})
          .sort({ duration: -1 })
          .toArray();
      }
    } else {
      return mongoUtil
          .getDB()
          .collection(TECHNIQUES)
          .find(query, {})
          .toArray();
    }

    // Need to place await in front of buildTechniqueQuery you pepeg

  }


  // Generic get request to retrieve technique from DB
  app.get("/techniques", async function (req, res) {
    let techniqueArrays = await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .find()
      .toArray();
    responseMessage(200, res, {
      techniqueArrays: techniqueArrays,
      sessionUser: expressSession.user_email || ""
    });
  });

  // Get a specific technique based on objectid 
  app.get("/technique/:id", async function (req, res) {
    let techniqueInfo = await mongoUtil.getDB().collection(TECHNIQUES).findOne({
      _id: mongodb.ObjectId(req.params.id)
    }, {});

    responseMessage(200, res, {
      techniqueInfo: techniqueInfo,
      sessionUser: expressSession.user_email || ""
    });
  })

  // Get a specific technique and all its comments
  app.get("/technique/:id/comments", async function (req, res) {

    let comments = await mongoUtil.getDB().collection(TECHNIQUES).find({
      _id: mongodb.ObjectId(req.params.id)
    }).project({
      _id: 0,
      comments: 1
    }).toArray();

    let listOfCommentIDs = comments[0].comments;
    let techniqueComments = [];

    for (let id of listOfCommentIDs) {
      let indivComment = await mongoUtil.getDB().collection(COMMENTS).find({
        _id: id
      }).project({}).toArray();
      techniqueComments.push(indivComment[0]);
    }
    responseMessage(200, res, techniqueComments);
  })

  // Generic post request to add a new technique to DB
  app.post("/technique/add", async function (req, res) {
    // techniques post request validation
    const techniqueSchema = joi
      .object({
        title: joi.string().required(),
        description: joi.string().required(),
        duration: joi.number().required(),
        difficulty: joi.string().required(),
        image: joi.string().required(),

        instructions: joi.array().min(1).required(),
        benefits: joi.array().min(1).required(),

        category: joi.array().min(1).required(),
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
        comments: []
      });
    responseMessage(200, res, req.body);
  });

  // Route to modify an existing technique
  app.put("/technique/:id", async function (req, res) {

    // techniques put request validation
    const techniqueSchema = joi
      .object({
        title: joi.string().required(),
        description: joi.string().required(),
        duration: joi.number().required(),
        difficulty: joi.string().required(),
        image: joi.string().required(),

        instructions: joi.array().min(1).required(),
        benefits: joi.array().min(1).required(),

        category: joi.array().min(1).required(),
        painpoints: joi.array().min(1).required(),

        comments: joi.array().required()
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

    const techniqueSchema = joi
      .object({
        id: joi.string().length(24).required(),
      })
      .required();

    const { error } = techniqueSchema.validate(req.params);
    if (error) throw new mongoErrors(error, 400);

    let techniqueInfo = await mongoUtil.getDB().collection(TECHNIQUES).findOne({
      _id: mongodb.ObjectId(req.params.id)
    }, {
      projection: {
        _id: 0,
        comments: 1
      }
    });

    for (let id of techniqueInfo.comments) {
      await mongoUtil.getDB().collection(COMMENTS).deleteOne({
        _id: id
      })
    }

    await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .deleteOne({
        _id: mongodb.ObjectId(req.params.id),
      });
    responseMessage(200, res, req.params);
  });



  // For technique search bar
  app.get("/techniques/search/:query/:filterOptions", async function (req, res) {

    // Fields need not be required
    const techniqueSearchSchema = joi.object({
      searchQuery: joi.string(),
      filterOptions: joi.object(),
    }).required();

    // Query payload
    let queryPayload = {
      searchQuery: req.params.query,
      filterOptions: JSON.parse(req.params.filterOptions)
    }

    const { error } = techniqueSearchSchema.validate(queryPayload);
    if (error) throw new mongoErrors(error, 400);

    let query = await buildTechniqueQuery(queryPayload, true);

    responseMessage(200, res, query);
  });



  // Add new comment (BEING USED -- techniqueDisplaly.js)
  app.post("/technique/:id/comment/add", async function (req, res) {

    // Validate req.params.id later
    const commentSchema = joi
      .object({
        comment: joi.string().min(1).required(),
        ratingScore: joi.number().required(),
      })
      .required();
    const { error } = commentSchema.validate(req.body);
    if (error) throw new mongoErrors(error, 400);

    const objectId = mongodb.ObjectId();

    await mongoUtil
      .getDB()
      .collection(COMMENTS)
      .insertOne({
        _id: objectId,
        ...req.body,
        user_email: expressSession.user_email || ""
      })



    await mongoUtil
      .getDB()
      .collection(TECHNIQUES)
      .updateOne({
        _id: mongodb.ObjectId(req.params.id)
      }, {
        $push: {
          comments: objectId
        }
      })

    responseMessage(200, res, {
      ...req.body,
      objectId: objectId
    });
  })



  app.put("/comment/:id", async function (req, res) {

    const commentSchema = joi
      .object({
        comment: joi.string().min(1).required(),
        ratingScore: joi.number().required(),
      })
      .required();

    const { error } = commentSchema.validate(req.body);
    if (error) throw new mongoErrors(error, 400);

    const objectId = mongodb.ObjectId();

    await mongoUtil.getDB().collection(COMMENTS).updateOne({
      _id: mongodb.ObjectId(req.params.id)
    }, {
      $set: {
        ...req.body,
        user_email: expressSession.user_email
      }
    })

    responseMessage(200, res, {
      ...req.body,
      user_email: expressSession.user_email
    });
  })


  app.delete("/technique/:technique_id/comment/:comment_id", async function (req, res) {
    const techniqueSchema = joi
      .object({
        technique_id: joi.string().length(24).required(),
        comment_id: joi.string().length(24).required(),
      })
      .required();

    const { error } = techniqueSchema.validate(req.params);
    if (error) throw new mongoErrors(error, 400);

    await mongoUtil.getDB().collection(TECHNIQUES).updateOne({
      _id: mongodb.ObjectId(req.params.technique_id)
    }, {
      $pull: {
        'comments': mongodb.ObjectId(req.params.comment_id)
      }
    })

    await mongoUtil
      .getDB()
      .collection(COMMENTS)
      .deleteOne({
        _id: mongodb.ObjectId(req.params.comment_id),
      });

    responseMessage(200, res, req.params);
  })


  app.delete("/technique/:id", async function (req, res) {
    // techniques delete request validation

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














  //  -------------------------------------------- USER EDIT --------------------------------------------
  app.put("/users/:id", async function (req, res) {
    let { firstName, lastName, email, username, password, profileImage } =
      req.body;

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


  // Basic error catching stuff here
  app.use((err, req, res, next) => {
    responseMessage(err.statusCode, res, err.message);
  })

}






main();

app.listen(PORT_NUMBER, function () {
  console.log(`server has started at port ${PORT_NUMBER}`);
});





