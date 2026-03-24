const router = require('express').Router();
const {
  getProfile, updateProfile, uploadAvatar, setStatus,
  blockUser, unblockUser, muteUser, searchUsers,
} = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { avatarUpload } = require('../middlewares/upload.middleware');

router.use(authenticate);

router.get('/search', searchUsers);
router.get('/:userId', getProfile);
router.put('/me', updateProfile);
router.post('/me/avatar', avatarUpload.single('avatar'), uploadAvatar);
router.patch('/me/status', setStatus);
router.post('/:userId/block', blockUser);
router.delete('/:userId/block', unblockUser);
router.post('/:userId/mute', muteUser);

module.exports = router;

