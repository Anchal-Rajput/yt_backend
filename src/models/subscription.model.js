import mongoose from "mongoose";

const subscriptionschema = new mongoose.Schema({
    subscriber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }, 
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
},{timestamps: true});

export const Subscription = mongoose.model("Subscription", subscriptionschema);