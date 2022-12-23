//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose")
const https = require("https")
const ejs = require("ejs");
const path = require("path")
require('dotenv').config();
const { url } = require("inspector");

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

const uri = process.env.MONGODB_URI
mongoose.connect(uri, {useNewUrlParser: true})



const questionSchema = {
  question: String,
  index: Number,
  answerChoices: [],
  answerVals: []
}

const userSchema = {
  username: String,
  createdPosts: [],
  answeredPosts: []
}

const postSchema = {
  title: String,
  questions: [questionSchema],
  answeredUsers: [],
  comments: [],
  numAnswers: Number,
  creator: String 
}



const commentSchema = {
  comment: String,
  createdUser: userSchema
}

const Question = mongoose.model("question", questionSchema)
const Post = mongoose.model("post", postSchema)
const User = mongoose.model("user", userSchema)
const Comment = mongoose.model("comment", commentSchema)

var currentUser = null


/////////////////////////////////////////////// START ROUTE
app.get("/", function(req, res){
  res.render("Login", {message: ""})
})

app.get("/e", function(req, res){
  res.render("Login", {message: "Username does not exist"})
})

app.post("/", function(req, res){
  User.exists({username: req.body.username}, function(err, user){
    if (user === null){
      res.redirect("/e")
    }
    else {
      currentUser = user
      res.redirect("/home/" + user._id)
    }
  })
})


///////////////////////////////////////////// SIGNUP
app.get("/signup", function(req, res){
  res.render("Signup")
})

app.post("/signup", function(req, res){
  const user = new User({
    username: req.body.username,
    createdPosts: [],
    answeredPosts: []
  })
  user.save()
  currentUser = user
  res.redirect("/home/" + user._id)
})



/////////////////////////////////////////////// HOME
app.get("/home/:userid", function(req, res){
  let displayposts = []
  let userposts = []
  let same = false

  User.findById(req.params.userid, function(err, user){
    user.answeredPosts.forEach((post) => {
      userposts.push(post)
    })
    user.createdPosts.forEach((post) => {
      userposts.push(post)
    })
    Post.find({}, function(err, posts){
      posts.forEach(function(post){
        userposts.forEach(function(userpost){
          if (post._id.equals(userpost._id)){
            same = true
          }
        })
        if (same === false){
          displayposts.push(post)
        }
        same = false
      })
      res.render("home", {posts: displayposts, user: user})
    })
  })
})

////////////////////////////////////////// GO HOME
app.get("/gohome", function(req, res){
  res.redirect("/home/" + currentUser._id)
})


////////////////////////////////////////// COMPOSE
app.get("/compose", function(req, res){
  console.log(currentUser)
  res.render("compose", {userid: currentUser._id})
})

app.get("/compose/:id/:err", function(req, res){
  Post.findById(req.params.id, function(err, post){
    if (req.params.err === "0"){
      res.render("composePost", {message: "", postid: req.params.id, postTitle: post.title, questions: post.questions})
    }
    else if (req.params.err === "1") {
      res.render("composePost", {message: "Post must have at least 1 question", postid: req.params.id, postTitle: post.title, questions: post.questions})
    }
    else if (req.params.err === "2"){
      res.render("composePost", {message: "All questions must have at least 1 answer choice", postid: req.params.id, postTitle: post.title, questions: post.questions})
    }
  })
})

app.get("/compose/:postid/:questionid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    Question.findById(req.params.questionid, function(err, question){
      res.render("ComposeQuestion", {questionTitle: question.question, postTitle: post.title, answerChoices: question.answerChoices, postid: req.params.postid, questionid: req.params.questionid})
    })
  })
})


app.post("/compose", function(req, res){
  User.findById(currentUser._id, (err, user) => {
    const post = new Post({
      title: req.body.postTitle,
      questions: [],
      creator: user.username
    })
    post.save()
    console.log(post.creator)
    const status = "0"
    res.redirect("/compose/" + post._id + "/" + status)
  })
})

app.post("/compose/:id", function(req, res){
  Post.findById(req.params.id, function(err, post){
    const question = new Question({
      question: req.body.questiontitle,
      index: post.questions.length + 1,
      answerChoices: []
    })
    question.save()
    post.questions.push(question)
    post.save()
    console.log(post)
  })
  const status = "0"
  res.redirect("/compose/" + req.params.id + "/" + status)
})

app.post("/compose/:postid/:questionid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    Question.findById(req.params.questionid, function(err, q){
      q.answerChoices.push(req.body.answerChoiceBody)
      q.answerVals.push(0)
      q.save()
      post.questions[q.index - 1] = q
      post.save()
    })
  })
  const status = "0"
  res.redirect("/compose/" + req.params.postid + "/" + status)
})




//////////////////////////////////////// CREATE POST
app.post("/createPost/:postid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    if (post.questions.length === 0){
      const status = "1"
      res.redirect("/compose/" + req.params.postid + "/" + status)
    }
    else {
      post.questions.forEach(question => {
        if (question.answerChoices.length === 0){
          const status = "2"
          res.redirect("/compose/" + req.params.postid + "/" + status)
        }
        else {
          User.findById(currentUser._id, function(err, user){
            post.numAnswers = 0
            post.save()
            user.createdPosts.push(post)
            user.save()
          })
          res.redirect("/home/" + currentUser._id)
        }
      })
    }
  })
})



///////////////////////////////////////// POSTS
app.get("/posts/:id", function(req, res){
  Post.findById(req.params.id, function(err, result){
    res.render("post", {postid: req.params.id, postTitle: result.title, Questions: result.questions})
  })
})

app.post("/posts/:postid/:questionid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    Question.findById(req.params.questionid, function(err, question){
      question.answerVals[question.answerChoices.indexOf(req.body.q)] += 1
      question.save()
      post.questions[question.index - 1] = question
      post.save()
    })
  })
  console.log("poweirpwoiropewir")
})

app.get("/posts/answerPost/:postid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    User.findById(currentUser._id, function(err, user){
      user.answeredPosts.push(post)
      user.save()
    })
    post.numAnswers += 1
    post.save()
  })
  res.redirect("/home/" + currentUser._id)
})

app.post("/test/:postid", function(req, res){
  console.log(req)
  res.redirect("/posts/answerPost/" + req.params.postid)
})

///////////////////////////////////////// RESULTS

app.get("/results", function(req, res){
  User.findById(currentUser._id, function(err, user){
    res.render("results", {answeredPosts: user.answeredPosts, createdPosts: user.createdPosts, username: user.username})
  })
})

app.get("/results/:postid", function(req, res){
  Post.findById(req.params.postid, function(err, post){
    const URLS = []

    post.questions.forEach(currentquestion => {
      const type = 'bar';
      const labels = currentquestion.answerChoices;
      const datasets = [
        { label: "Answers", data: currentquestion.answerVals},
      ];
  
      const chartData = `{type: '${type}', data: {labels: ${JSON.stringify(labels)}, datasets: ${JSON.stringify(datasets)}}}`;
      const chartURL = `https://quickchart.io/chart?c=${chartData}`;
      URLS.push(chartURL)
    })
    
    User.findById(currentUser._id, function(err, user){
      res.render("postresults", {imageurls: URLS, post: post, postTitle: post.title, Questions: post.questions, username: user.username})
    })
  })
})


///////////////////////////////////////// COMMENTS

app.post("/comment/:postid", function(req, res){
  User.findById(currentUser._id, function(err, user){
    const comment = new Comment({
      comment: req.body.commentbody,
      createdUser: user
    })
    comment.save()
    Post.findById(req.params.postid, function(err, post){
      post.comments.push(comment)
      post.save()
    })
  })
  res.redirect("/results/" + req.params.postid)
})

app.listen(3000, function() {
  console.log("Server started on port 3000");
});







  ///////////////////////////////////       TO-DO LIST (REACT MIGRATION AND HEROKU DEPLOYMENT)       ////////////////////////////////////////
//- migrate everything to REACT and learn how to make the whole stack and everything
//- maybe see how to incorporate another technology possibly - TailwindCSS
//- rewatch udemy tutorial and set everything up on heroku to deploy



//                                         Projected finish date: January 16th, 2023


//mongo atlas cluster authentication
// username: adi123
// password: 123