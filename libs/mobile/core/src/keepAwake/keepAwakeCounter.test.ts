import { createKeepAwakeCounter } from './keepAwakeCounter';

function fakeWake() {
  return { activate: jest.fn(), deactivate: jest.fn() };
}

describe('createKeepAwakeCounter', () => {
  it('turns the screen on with the first holder and off with the last', () => {
    const wake = fakeWake();
    const counter = createKeepAwakeCounter(wake);

    const releaseA = counter.acquire();
    const releaseB = counter.acquire();
    expect(wake.activate).toHaveBeenCalledTimes(1);

    releaseA();
    expect(wake.deactivate).not.toHaveBeenCalled();

    releaseB();
    expect(wake.deactivate).toHaveBeenCalledTimes(1);
  });

  it('ignores a second release from the same holder', () => {
    const wake = fakeWake();
    const counter = createKeepAwakeCounter(wake);

    const releaseA = counter.acquire();
    const releaseB = counter.acquire();
    releaseA();
    releaseA();

    expect(wake.deactivate).not.toHaveBeenCalled();
    releaseB();
    expect(wake.deactivate).toHaveBeenCalledTimes(1);
  });

  it('turns the screen on again for a holder after everyone released', () => {
    const wake = fakeWake();
    const counter = createKeepAwakeCounter(wake);

    counter.acquire()();
    counter.acquire();

    expect(wake.activate).toHaveBeenCalledTimes(2);
    expect(wake.deactivate).toHaveBeenCalledTimes(1);
  });
});
