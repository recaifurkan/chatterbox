function successResponse(res, data, message = 'Success', statusCode = 200, meta = null) {
  const response = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
}

function errorResponse(res, message = 'Error', statusCode = 500, errors = null) {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
}

function paginationMeta(total, page, limit) {
  return {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = { successResponse, errorResponse, paginationMeta };

