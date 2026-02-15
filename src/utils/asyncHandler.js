const asyncHandler = (requestHandles) => {
    return (req, res, next) => {
        Promise
        .resolve(requestHandles(req, res, next))
        .catch((err) => {next(err)})
    }
}

export {asyncHandler}