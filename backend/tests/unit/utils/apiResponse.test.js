const { successResponse, errorResponse, paginationMeta } = require('../../../src/utils/apiResponse');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('apiResponse', () => {
  describe('successResponse', () => {
    it('returns 200 with success:true by default', () => {
      const res = mockRes();
      successResponse(res, { foo: 'bar' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { foo: 'bar' } })
      );
    });

    it('uses provided statusCode', () => {
      const res = mockRes();
      successResponse(res, null, 'Created', 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('includes meta when provided', () => {
      const res = mockRes();
      const meta = { total: 10, page: 1 };
      successResponse(res, {}, 'OK', 200, meta);
      const payload = res.json.mock.calls[0][0];
      expect(payload.meta).toEqual(meta);
    });

    it('does not include meta when null', () => {
      const res = mockRes();
      successResponse(res, {}, 'OK', 200, null);
      const payload = res.json.mock.calls[0][0];
      expect(payload.meta).toBeUndefined();
    });

    it('sets the message field', () => {
      const res = mockRes();
      successResponse(res, null, 'Done');
      expect(res.json.mock.calls[0][0].message).toBe('Done');
    });
  });

  describe('errorResponse', () => {
    it('returns 500 with success:false by default', () => {
      const res = mockRes();
      errorResponse(res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('uses provided statusCode and message', () => {
      const res = mockRes();
      errorResponse(res, 'Not found', 404);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].message).toBe('Not found');
    });

    it('includes errors array when provided', () => {
      const res = mockRes();
      errorResponse(res, 'Validation failed', 422, ['field required']);
      const payload = res.json.mock.calls[0][0];
      expect(payload.errors).toEqual(['field required']);
    });

    it('does not include errors when null', () => {
      const res = mockRes();
      errorResponse(res, 'Error', 400, null);
      const payload = res.json.mock.calls[0][0];
      expect(payload.errors).toBeUndefined();
    });
  });

  describe('paginationMeta', () => {
    it('calculates totalPages correctly', () => {
      const meta = paginationMeta(100, 1, 20);
      expect(meta.totalPages).toBe(5);
    });

    it('hasNextPage is true when more pages exist', () => {
      const meta = paginationMeta(100, 1, 20);
      expect(meta.hasNextPage).toBe(true);
    });

    it('hasNextPage is false on last page', () => {
      const meta = paginationMeta(100, 5, 20);
      expect(meta.hasNextPage).toBe(false);
    });

    it('hasPrevPage is false on first page', () => {
      const meta = paginationMeta(100, 1, 20);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('hasPrevPage is true after first page', () => {
      const meta = paginationMeta(100, 2, 20);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('returns correct total and page values', () => {
      const meta = paginationMeta(47, 3, 10);
      expect(meta.total).toBe(47);
      expect(meta.page).toBe(3);
      expect(meta.limit).toBe(10);
      expect(meta.totalPages).toBe(5);
    });
  });
});

