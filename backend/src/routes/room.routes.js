const router = require('express').Router();
const {
  getRooms, getMyRooms, getRoom, createRoom, joinRoom,
  leaveRoom, updateRoom, deleteRoom, promoteUser, getRoomMembers, addMember, createOrGetDM,
} = require('../controllers/room.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', getRooms);
router.get('/my', getMyRooms);
router.post('/dm', createOrGetDM);
router.post('/', createRoom);
router.get('/:id', getRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);
router.post('/:id/join', joinRoom);
router.post('/:id/leave', leaveRoom);
router.get('/:id/members', getRoomMembers);
router.post('/:id/members', addMember);
router.patch('/:id/members/role', promoteUser);

module.exports = router;



