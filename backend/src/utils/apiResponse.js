export const successResponse = (res, data, message = "Success") => {
  return res.status(200).json({
    success: true,
    message,
    data
  });
};

export const errorResponse = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message
  });
};
