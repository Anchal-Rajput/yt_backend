import  { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


//making cookies modified only from server side not from fronted
const options = {
        httpOnly: true,
        secure: true
}

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken};
        
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh tokens");
    }
}

const registerUser = asyncHandler(async(req, res) => {
    //1. get user details
    const{userName, email, fullName, password} = req.body;

    // console.log("FILES ", req.files);
    // console.log("BODY ", req.body);


    //2. validation- entry cannot be empty
    if(
        [userName, fullName, email, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required!!");
    }

    //3. check if user already exists or not with same email or userName
    const existedUser = await User.findOne({
        $or : [{userName}, {email}]
    })

    if(existedUser) throw new ApiError(409,"User will same userName or email already exists!!");

    //4. check for image
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // const avatarLocalPath = req.files?.avatar[0]?.path;
    // const covreImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) throw new ApiError(400,"Avatar is required!!");

    //5.Upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("AVATAR RESPONSE ", avatar);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    //if(!avatar) throw new ApiError(400,"Avatar is required!!");
    if (!req.files || !req.files.avatar || req.files.avatar.length === 0) {
        throw new ApiError(400, "Avatar is required!!");
    }


    //6. create user obj
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()
    })

    //7. removing password and refresh token from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    //8. check user created in db or not
    if(!createdUser)    throw new ApiError(500, "Something went WRONG while creating user in DB");

    //9. return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered SUCCESSFULLY!!")
    );
})

const loginUser = asyncHandler(async(req, res) => {

    //1. taking data from user
    const {userName, email, password} = req.body;

    if(!(userName || email)) throw new ApiError(400,"Email or userName is required!!");

    //2. find user in db with this email or userName
    const user = await User.findOne({
        $or: [{userName}, {email}]
    })

    if(!user)   throw new ApiError(404,"User with this userName or email not exists!!");

    //3. if user exist checking is password correct
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid)    throw new ApiError(401, "Invalid password!!");

    //4.generating access and refresh tokens
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    //5. send cookies
    const loggedInUser = await User.findById(user._id);
   

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
            {
                user : loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in SUCCESSFULLY!!!"
        )
    );
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(req.user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out SUCCESSFULLY!!"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    //1. taking refresh token from url
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incommingRefreshToken)  throw new ApiError(401, "Unauthorized access");

    //2. Verify refresh token using secret key, check expiry & return decoded payload (user data)
    const decodedToken = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    //3. accessing user from decodedtoken id
    try {
        const user = await User.findById(decodedToken?._id)
    
        if(!user)   throw new ApiError(401, "Invalid refresh token");
    
        //4. checking the refresh token comming from url and the stored in DB for thid user we accessed
        if(incommingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                {
                    accessToken, newRefreshToken
                },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

export {registerUser,
        loginUser,
        logoutUser,
        refreshAccessToken
}