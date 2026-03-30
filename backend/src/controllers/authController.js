const pool = require("../config/db")
const bcrypt = require("bcrypt")

exports.registerUser = async (req,res) => {

try{

const {username,email,password} = req.body

const hashedPassword = await bcrypt.hash(password,10)

const result = await pool.query(
`INSERT INTO users (username,email,password_hash)
VALUES ($1,$2,$3)
RETURNING user_id,username,email`,
[username,email,hashedPassword]
)

res.status(201).json({
message:"User registered",
user:result.rows[0]
})

}catch(err){

if(err.code === "23505"){
return res.status(400).json({error:"Username or Email already exists"})
}

res.status(500).json({error:"Server error"})

}

}



const jwt = require("jsonwebtoken")

exports.loginUser = async (req,res)=>{

try{

const {email,password} = req.body

const result = await pool.query(
"SELECT * FROM users WHERE email=$1",
[email]
)

if(result.rows.length === 0){
return res.status(401).json({error:"Invalid credentials"})
}

const user = result.rows[0]

const validPassword = await bcrypt.compare(password,user.password_hash)

if(!validPassword){
return res.status(401).json({error:"Invalid credentials"})
}

const token = jwt.sign(
{user_id:user.user_id},
"secretkey",
{expiresIn:"7d"}
)

res.json({
token,
user:{
id:user.user_id,
username:user.username
}
})

}catch(err){
res.status(500).json({error:"Server error"})
}

}