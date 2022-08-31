require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose= require("mongoose");
// const encrypt=require("mongoose-encryption");
// const md5=require("md5");
// const bcrypt=require("bcrypt");
// const saltRound=10;
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
const findorcreate=require("mongoose-findorcreate");

const ejs= require("ejs");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret:"Our little secret.",
    resave:false,
    saveUninitialized:false
    }
));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");
const userSchema= new mongoose.Schema({
    email:String,
    password:String,
    googleId:String,
    secret:String
});
// userSchema.plugin(encrypt,{secret:process.env.SECRET, encryptedFields:['password']});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findorcreate);

const User=new mongoose.model("User",userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",(req,res)=>{
    res.render("home");
});

app.get("/auth/google", passport.authenticate("google",{scope: ["profile"]}));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
});

app.route("/register")
.get((req,res)=>{
    res.render("register");
})
.post((req,res)=>{
    // bcrypt.hash(req.body.password, saltRound, (err,hash)=>{
    //     const newUser= new User({
    //         email:req.body.username,
    //         // password:md5(req.body.password)
    //         password:hash
    //     });
    //     newUser.save((err)=>{
    //         if(err){
    //             console.log(err);
    //         }
    //     else{
    //            res.render("secrets");
    //        }
    //     });
    // })

    User.register({username:req.body.username}, req.body.password, (err, user)=>{
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req,res,()=>{
                res.redirect("/secrets");
            });
        }
    });
});

app.route("/login")
.get((req,res)=>{
    res.render("login");
})
.post((req,res)=>{
    // User.findOne(
    //     {email:req.body.username},
    //     (err,found)=>{
    //         if(found){
    //             bcrypt.compare(req.body.password, found.password, (err, f)=>{
    //                 if(f===true){
    //                     res.render("secrets");
    //                 }
    //             });
    //         }
    //     }
    // )

    const user= new User({
        username:req.body.username,
        password:req.body.password
    });
    req.login(user, (err)=>{
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req, res, ()=>{
                res.redirect("/secrets");
            });
        }
    });
});

app.get("/secrets",(req,res)=>{
    User.find({"secret":{$ne:null}}, (err,found)=>{
        if(err){
            console.log(err);
        }else{
            if(found){
                res.render("secrets",{userwSec:found});
            }
        }
    })
});

app.get("/logout",(req,res)=>{
    req.logout((err)=>{
        if(err){
            console.log(err);
        }
        else{
            res.redirect("/");
        }
    });
})

app.route("/submit")
.get((req,res)=>{
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
})
.post((req,res)=>{
    const sec=req.body.secret;
    User.findById(req.user.id, (err,found)=>{
        if(err){
            console.log(err);
        }else{
            if(found){
                found.secret=sec;
                found.save(()=>{
                    res.redirect("/secrets");
                })
            }
        }
    })
});

app.listen(3000,()=>{
    console.log("Server successfully started");
})
