export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function created(res, data) {
  return ok(res, data, 201);
}

export function pickDefined(input, allowedFields) {
  return allowedFields.reduce((acc, field) => {
    if (input[field] !== undefined) {
      acc[field] = input[field];
    }
    return acc;
  }, {});
}
