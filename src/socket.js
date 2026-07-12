import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: Infinity, 
        timeout: 10000,
        transports: ['websocket'],
    };
    const backendUrl = import.meta.env.PROD ? '/' : import.meta.env.VITE_BACKEND_URL;
    return io(backendUrl, options);
};
