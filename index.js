const express = require('express');
const app = express();
const mysql = require('mysql');
const fetch = require("node-fetch");
const bcrypt = require('bcrypt');
const session = require('express-session');
const pool = dbConnection();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true})); //makes it possible to get values using POST method
//---------------------------------------------Middleware and session setup---------------------------------------------------

//store user's info when they log in
var user = {
  userId: 0,
  username: "",
  email: "",
  name: ""
};

//function for authenticating user login
function isAuthenticated(req, res, next) {
  if(!req.session.authenticated) {
    res.redirect("/login");
  } else {
    next();
  }
}


//sessions
app.use(session({
  secret: "secret!",
  resave: false,
  saveUninitialized: true
}));

//---------------------------------------------Routes---------------------------------------------------

//home route
app.get('/', async (req, res) => {
  res.render('home', {
    authenticated: req.session.authenticated,
    user: user
  });
});


const getUserList = async (id) => {
    let sql = `SELECT *
        from recipes
        WHERE recipeId IN (
            SELECT recipeId
            FROM recipe_lists
            where userId = ?
        )
        group by recipeId`;
  let params = [id];
  const results = await executeSQL(sql, [params]);

  return results;
}

//list GET route
app.get('/list', isAuthenticated, async (req, res) => {


  const results = await getUserList(req.query.userId)
  
  res.render('list', {
    authenticated: req.session.authenticated,
    user: user,
    results
  });
});

//list POST route
app.post('/list' , async (req, res) => {
  let rowAffected = false;
  let statusCode = 200;

  if (req.query) {
    let sql = "INSERT INTO recipe_lists (recipeId, userId) VALUES (?, ?)";
    let params = [req.query.recipeId, req.query.userId];
    let rows = await executeSQL(sql, params)
    if (rows.affectedRows == 1) {
        rowAffected = true;
    }

    res.sendStatus(statusCode)
  } else {
    statusCode = 500;
    res.sendStatus(statusCode)
  }
});

//list DELETE route
app.delete('/list', isAuthenticated, async (req, res) => {
  const { userId, recipeId } = req.query;
  let sql = 'DELETE FROM recipe_lists WHERE recipeId = ?';
  sql += ' AND userId = ?'
  const params = [recipeId, userId];

  const results = await executeSQL(sql, params);
  const newResults = await getUserList(userId)

   res.send(200)
})

//profile route
app.get('/profile', async (req, res) => {
  res.render('profile', {
    user,
    authenticated: req.session.authenticated
  })
})

//search route
app.get('/search', async (req, res) => {
  let sql_categories = `SELECT DISTINCT category FROM recipes`;
  let categories = await executeSQL(sql_categories);


  res.render('search', {
    "categories": categories,
    authenticated: req.session.authenticated,
    user: user
  })
});

//search results route
app.get("/results", async function(req, res) {

  let word = req.query.keyword;

  let sql = `SELECT recipeId, userId, name, category, time, ingredients, directions, photo, author FROM recipes WHERE name OR ingredients LIKE ? `;
  let params = [`%${word}%`];

  if (req.query.time) { //if time was selected
    if(req.query.time <= 60) {
      sql += "AND time <= ? ";
    } else {
      sql += "AND time > ? ";
    }
    
    params.push(req.query.time);
  }

  if (req.query.category) { //if category was selected
    sql += "AND category = ? ";
    params.push(req.query.category);
  }

  let results = await executeSQL(sql, params);
  res.render('results', { 
    "results": results,
    authenticated: req.session.authenticated,
    user: user
  });
});

//about route
app.get('/about', async (req, res) => {
  res.render('about', {
    authenticated: req.session.authenticated,
    user: user
  });
});



//register GET route
app.get('/register', async (req, res) => {
  res.render('register', {
    authenticated: req.session.authenticated,
    user: user
  });
});

//register POST route
app.post('/register', async (req, res) => {
  let rowAffected = false;
  if(req.body.name){
    let sql = "INSERT INTO recipe_users (username, password, email, name) VALUES (?,?,?,?)";
    let params = [req.body.username, req.body.password, req.body.email, req.body.name];
    var rows = await executeSQL(sql, params);

    if (rows.affectedRows == 1) {
      rowAffected = true;
    }
  }

  res.render('register', {
    "userAdded" : rowAffected,
    authenticated: req.session.authenticated,
    user: user
  });
});

app.get('/register', async (req,res) => {
  res.render('register')
})


//addRecipe route
app.get('/addRecipe', isAuthenticated, async (req, res) => {
  let sql_categories = "SELECT DISTINCT category FROM recipes";
  let categories = await executeSQL(sql_categories);
  
  let categoryId = 0;
  if (req.query.category !== '') {

    switch (req.query.category) {
      case 'snack':
      categoryId = 1;
      break;
      case 'breakfast':
      categoryId = 2;
      break;
      case 'dinner':
      categoryId = 4;
      break;
      case 'lunch':
      categoryId = 3;
      break;
      default:
      categoryId = 1;
    }

  }

  let rowAffected = false;
  if (req.query.name) {
    let sql = "INSERT INTO recipes (userId, name, category, time, ingredients, directions, photo, author, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    let params = [user.userId, req.query.name, req.query.category, req.query.time, req.query.ingredients, req.query.directions, req.query.photo, user.username, categoryId];

    let rows = await executeSQL(sql, params)
    if (rows.affectedRows == 1) {
        rowAffected = true;
    }
  }

  res.render('addRecipe', {
    "categories": categories,
    "recipeAdded": rowAffected,
    authenticated: req.session.authenticated,
    user: user
  });
});

/*
 * updateRecipe route
 */
app.get('/updateRecipe', isAuthenticated, async (req, res) => {

  let rowAffected = false;
  if(req.query.name){
    //form to update recipe was submitted
    let sql = "UPDATE recipes SET userId = ?, name = ?, category = ?, time = ?, ingredients = ?, directions = ?, photo = ?, author = ? WHERE recipeId = ?";
    let params = [user.userId, req.query.name, req.query.category, req.query.time, req.query.ingredients, req.query.directions, req.query.photo, user.username, req.query.recipeId];
    let rows = await executeSQL(sql, params);

    if (rows.affectedRows == 1) {
      rowAffected = true;
    }
  }

  //get categories for dropdown menu
  let sql_categories = "SELECT DISTINCT category FROM recipes";
  let categories = await executeSQL(sql_categories);

  let sql = "SELECT * FROM recipes WHERE recipeId = ?";
  let rows = await executeSQL(sql, [req.query.recipeId]);
  res.render('updateRecipe', {
    "rows": rows,
    "recipeUpdated": rowAffected,
    "categories": categories,
    authenticated: req.session.authenticated,
    user: user
  })
  
});

/*
 * deleteRecipe route
 */
app.get('/deleteRecipe', isAuthenticated, async (req, res) => {
  let sql = "DELETE FROM recipes WHERE recipeId = ?";
  let rows = await executeSQL(sql, [req.query.recipeId]);

  res.redirect("/");
});

//login GET route
app.get('/login', (req, res) => {
  res.render('login', {
      error: "",
      authenticated: req.session.authenticated,
      user: user
  })
});

//login POST route
app.post('/login', async (req, res) => {
  req.session.authenticated = false;
  authenticated = req.session.authenticated;

  //check credentials here
  let password = "";
  let username = req.body.username; //getting data using POST method
  let userPassword = req.body.password;

  //get username and password from database
  let sql = "SELECT * FROM recipe_users WHERE username = ?";
  let rows = await executeSQL(sql, [username]);

  
  if(rows.length > 0) {
    password = rows[0].password; //value of password from database
  }

  let passwordMatch = (password == userPassword);

  //req.session.authenticated = false;

  if(passwordMatch) {
    user.userId = rows[0].userId;
    user.username = rows[0].username;
    user.email = rows[0].email;
    user.name = rows[0].name;

    req.session.authenticated = true;
    res.render("home", {
      authenticated: req.session.authenticated,
      user: user
    });
    
  } else {
    user.userId = 0;
    user.username = "";
    user.email = "";
    user.name = "";

    res.render("login", {
      error: "Invalid credentials",
      authenticated: req.session.authenticated,
      user: user
    });
  }
});

//logout route
app.get('/logout', (req, res) => {
  user.userId = 0;
  user.username = "";
  user.email = "";
  user.name = "";

  req.session.destroy();
  res.redirect("/");
});

//---------------------------------------------Endpoint Routes---------------------------------------------------

//recipes table endpoint
app.get('/recipes', async (req, res) => {
  // Get Recipes
    let sql = "SELECT * FROM recipes";
    let results = await executeSQL(sql);

    res.send(results);
})

app.get('/categories/:categoryId/recipes', async (req, res) => {
    const {categoryId} = req.params;
    let categoryParams = [categoryId];
    let sql = "SELECT * FROM recipes WHERE categoryId = ?";
    const results = await executeSQL(sql, [categoryParams]);
    //user = "";
    res.render('categoryRecipePage', {results,
      authenticated: req.session.authenticated,
      user: user
    })
})

app.get('/recipes/:recipeId', async (req, res) => {
    const recipeId = req.params.recipeId;

    let sql = "SELECT * FROM recipes";
    let recipeParams = [];
    
    if (req.params.recipeId) { //if recipe was selected (if recipeId has any value)
        sql += " WHERE recipeId = ? ";
        recipeParams.push(req.params.recipeId);
    }

    const results = await executeSQL(sql, recipeParams);
    res.send(results);
})


//---------------------------------------------Database setup and query---------------------------------------------------

//function for querying the database 
async function executeSQL(sql, params) {

  return new Promise(function(resolve, reject) {
    //let conn = dbConnection();
    
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });

}

//database
function dbConnection() {

  const pool = mysql.createPool({

    connectionLimit: 1000,
    host: "wiad5ra41q8129zn.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "qf7d0xcoxx04dr6v",
    password: "a0twz7veq2mv2s8a",
    database: "yto45t25jp313qtq"

  });

  return pool;

}

//initialize server
app.listen(3000, () => {
  console.log('server started');
});
