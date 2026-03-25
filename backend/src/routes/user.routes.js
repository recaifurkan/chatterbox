const router = require('express').Router();
const createUserController = require('../controllers/user.controller');
const { userService } = require('../container');
const { authenticate } = require('../middlewares/auth.middleware');
const { avatarUpload } = require('../middlewares/upload.middleware');

const {
  getProfile, updateProfile, uploadAvatar, setStatus,
  blockUser, unblockUser, muteUser, searchUsers,
} = createUserController(userService);

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

