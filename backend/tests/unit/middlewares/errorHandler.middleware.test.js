/**
 * Unit tests for errorHandler.middleware.js
 */
const { errorHandler } = require('../../../src/middlewares/errorHandler.middleware');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return { url: '/test', method: 'GET', ip: '127.0.0.1' };
}

describe('errorHandler middleware', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  it('handles Mongoose ValidationError → 400', () => {
    const err = { name: 'ValidationError', errors: { email: { message: 'invalid email' } } };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.errors).toContain('invalid email');
  });

  it('handles MongoDB duplicate key error → 409', () => {
    const err = { code: 11000, keyValue: { email: 'dup@test.com' } };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it('handles Mongoose CastError → 400', () => {
    const err = { name: 'CastError', message: 'Cast to ObjectId failed' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('Invalid ID format');
  });

  it('handles JsonWebTokenError → 401', () => {
    const err = { name: 'JsonWebTokenError', message: 'invalid signature' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('handles LIMIT_FILE_SIZE → 400', () => {
    const err = { code: 'LIMIT_FILE_SIZE', message: 'File too large' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('File too large');
  });

  it('handles LIMIT_FILE_COUNT → 400', () => {
    const err = { code: 'LIMIT_FILE_COUNT' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('Too many files');
  });

  it('uses err.statusCode when present', () => {
    const err = { statusCode: 422, message: 'Unprocessable' };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].message).toBe('Unprocessable');
  });

  it('defaults to 500 for generic errors', () => {
    const err = new Error('Something went wrong');
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

