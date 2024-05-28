const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { log } = require('handlebars');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;
require('dotenv').config();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// call the database initialization function before starting to listen for incoming requests
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const dbFileName = process.env.DB_FILE || 'test.db';
let db;

async function initializeDB() {
    db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
    console.log('Database initialized.');
}

async function getDB() {
    if (!db) {
        await initializeDB();
    }
    return db;
}

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'MicroBlog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
const accessToken = process.env.EMOJI_API_KEY;

app.get('/', async (req, res) => {
    const db = await getDB();
    const posts = await db.all('SELECT * FROM posts ORDER BY timestamp DESC')
    const user = await getCurrentUser(req) || {};
    res.render('home', { posts, user, accessToken });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

app.post('/posts', async (req, res) => {
    // TODO: Add a new post and redirect to home
    const title = req.body.title;
    const content = req.body.content;
    const user = await getCurrentUser(req);
    
    if (user) {
        await addPost(title, content, user);
        res.redirect('/');
    } else {
        res.redirect('/login');
    }

});
app.post('/like/:id', async (req, res) => {
    // TODO: Update post likes
    await updatePostLikes(req, res);
});
app.get('/profile', isAuthenticated, async (req, res) => {
    // TODO: Render profile page
    await renderProfile(req, res);
});
app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    handleAvatar(req, res);
});
app.post('/register', async (req, res) => {
    // TODO: Register a new user
    await registerUser(req, res);
});
app.post('/login', async (req, res) => {
    // TODO: Login a user
    await loginUser(req, res);

});
app.get('/logout', (req, res) => {
    // TODO: Logout the user
    logoutUser(req, res);
});

app.post('/delete/:id', isAuthenticated, async (req, res) => {
    // TODO: Delete a post if the current user is the owner
    const postId = req.params.id;
    const user = await getCurrentUser(req);
    const db = await getDB();
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);
    // const postIndex = posts.findIndex(post => post.id === parseInt(postId));

    if (post && post.username === user.username) {
        await db.run('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Post not found.' });
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });

(async () => {
    try {
        await initializeDB();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1); // Exit the process with a failure code
    }
})();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    if(users.find(user => user.username === username)){
        return users.find(user => user.username === username);
    }
    else{
        return undefined;
    }
}

// Function to find a user by user ID
function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    if(users.find(user => user.id === userId)){
        return users.find(user => user.id === userId);
    }
    else{ 
        return undefined;
    }
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
async function registerUser(req, res) {
    // TODO: Register a new user and redirect appropriately
    const username = req.body.username;
    const password = req.body.password;
    const db = await getDB();
    console.log("attempting to register a user: ", username);

    try {
        const avatar_url = saveAvatar(username);
        await db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [username, password, avatar_url, new Date().toISOString()]
        );
        res.redirect('/login');
    } catch (error) {
        res.redirect('/register?error=Username already exists');
    }
}

// Function to login a user
async function loginUser(req, res) {
    // TODO: Login a user and redirect appropriately
    const db = await getDB();
    const username = req.body.username;
    const password = req.body.password;

    const user = await db.get('SELECT * FROM users WHERE username = ? AND hashedGoogleId = ?', [username, password]);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    }
    else {
        res.redirect('/login?error=Invalid username or password. Try again');
    }
}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy(err => {
        if (err) {
            console.log("Error destroying session");
            res.redirect('/error');
        } else {
            res.redirect('/');
        }
    });
}

// Function to render the profile page
async function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    const db = await getDB();
    const user = await getCurrentUser(req);
    if (user) {
        const usr_posts = await db.all("SELECT * FROM posts WHERE username = ?", [user.username]);
        console.log("user posts", usr_posts);
        res.render('profile', { user, usr_posts });
    } else {
        // If user is not authenticated, redirect to login
        res.redirect('/login');
    }
}

// Function to update post likes
async function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
    const userId = req.session.userId;
    const postId = req.params.id;
    const db = await getDB();

    try {
        const result = await db.run("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);
        // check if any rows were updated
        if (result.changes > 0) {
            const updatedPost = await db.get('SELECT likes FROM posts WHERE id = ?', [postId]);
            res.json({ success: true, likes: updatedPost.likes });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error('Error updating post likes:', error);
        res.json({ success: false });
    }
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    const username = req.params.username;
    const letter = username.charAt(0).toUpperCase();
    const avatarBuffer = generateAvatar(letter);
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(avatarBuffer, 'binary');
}

// Function to get the current user from session
async function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    const db = await getDB();
    userID = req.session.userId;
    if (userID !== undefined) {
        return await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    }
    else {
        return undefined;
    }
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
async function addPost(title, content, user) {
    // TODO: Create a new post object and add to posts array
    const db = await getDB();
    const timestamp = new Date().toLocaleString();
    const avatar_url = user.avatar_url;
    await db.run(
        'INSERT INTO posts (title, content, username, timestamp, avatar_url, likes) VALUES (?, ?, ?, ?, ?, ?)',
        [title, content, user.username, timestamp, avatar_url, 0]
    );
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    const backgroundColor = getRandomColor();
    // 2. Create a canvas with the specified width and height
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // 3. Draw the background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 4. Draw the letter in the center
    ctx.fillStyle = '#000';
    ctx.font = `${width / 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, width / 2, height / 2);

    // 5. Return the avatar as a PNG buffer
    return canvas.toBuffer();
}

// Function to generate a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Function to save the avatar to a file and return the URL
function saveAvatar(username) {
    const letter = username.charAt(0).toUpperCase();
    const avatarBuffer = generateAvatar(letter);
    const avatarPath = path.join(__dirname, 'public', 'avatars', `${username}.png`);
    fs.mkdirSync(path.dirname(avatarPath), { recursive: true });
    fs.writeFileSync(avatarPath, avatarBuffer);

    // Return the URL for the avatar
    return `/avatars/${username}.png`;
}