const router = require('express').Router();
const createRoomController = require('../controllers/room.controller');
const { roomService } = require('../container');
const { authenticate } = require('../container');

const {
  getRooms, getMyRooms, getRoom, createRoom, joinRoom,
  leaveRoom, updateRoom, deleteRoom, promoteUser, getRoomMembers, addMember, createOrGetDM,
} = createRoomController(roomService);

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



