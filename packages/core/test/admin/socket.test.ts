import { EventEmitter } from 'node:events';

import { io as socketIo } from 'socket.io-client';

import { createAdminSocket, type AdminIo } from '../../src/admin/socket';
import { makeAdminOrder, makeAdminTrading } from './fixtures';

jest.mock('socket.io-client', () => ({ io: jest.fn(() => ({ on: jest.fn() })) }));

class FakeIo extends EventEmitter {
  connected = false;
  active = false;
  connect = jest.fn(() => {
    this.connected = true;
    this.active = true;
  });
  disconnect = jest.fn(() => {
    this.connected = false;
    this.active = false;
  });
}

function setup(onUnauthorized = jest.fn()) {
  const io = new FakeIo();
  const createSocket = jest.fn(() => io as unknown as AdminIo);
  const socket = createAdminSocket({ url: 'http://admin/', onUnauthorized, createSocket });
  return { io, socket, createSocket, onUnauthorized };
}

describe('createAdminSocket', () => {
  it('connects to the admin namespace once', () => {
    const { io, socket, createSocket } = setup();

    socket.connect();
    socket.connect();

    expect(createSocket).toHaveBeenCalledWith('http://admin/admin');
    expect(io.connect).toHaveBeenCalledTimes(1);
    socket.disconnect();
    expect(io.disconnect).toHaveBeenCalled();
  });

  it('relays valid order and trading events and drops unknown shapes', () => {
    const { io, socket } = setup();
    const onOrder = jest.fn();
    const onTrading = jest.fn();
    const stop = socket.onOrder(onOrder);
    socket.onTrading(onTrading);
    const order = makeAdminOrder();
    const trading = makeAdminTrading();

    io.emit('admin.order', { v: 1, order });
    io.emit('admin.order', { v: 2, order });
    io.emit('admin.trading', { v: 1, trading });
    io.emit('admin.trading', { v: 1, trading: { nope: true } });

    expect(onOrder).toHaveBeenCalledTimes(1);
    expect(onOrder).toHaveBeenCalledWith(order);
    expect(onTrading).toHaveBeenCalledWith(trading);
    expect(onTrading).toHaveBeenCalledTimes(1);

    stop();
    io.emit('admin.order', { v: 1, order });
    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('opens its own connection, polling first, so the session cookie reaches the handshake', () => {
    createAdminSocket({ url: 'http://admin' });

    expect(socketIo).toHaveBeenCalledWith(
      'http://admin/admin',
      expect.objectContaining({
        multiplex: false,
        transports: ['polling', 'websocket'],
        withCredentials: true,
      }),
    );
  });

  it('reports a rejected session handshake', () => {
    const { io, onUnauthorized } = setup();

    io.emit('connect_error', new Error('timeout'));
    expect(onUnauthorized).not.toHaveBeenCalled();
    io.emit('connect_error', new Error('Unauthorized'));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
