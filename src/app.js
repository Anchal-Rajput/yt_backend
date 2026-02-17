import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//cors configuration

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//taking data from url, form etc

app.use(express.json({limit: "16kb"}))  //from forms
app.use(express.urlencoded({extended: true, limit: "16kb"}))    //from url
app.use(express.static("public"))   //assits from local storage

//cookie-parser config

app.use(cookieParser())

import userRouter from "./routes/user.router.js";

app.use("/api/v1/users", userRouter);

export { app }