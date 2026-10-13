import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

describe('ServiceWorkerRegistration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let register: jest.Mock;

  function installServiceWorker(): void {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
  }

  function removeServiceWorker(): void {
    delete (navigator as unknown as Record<string, unknown>)['serviceWorker'];
  }

  beforeEach(() => {
    register = jest.fn(() => Promise.resolve({}));
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    removeServiceWorker();
  });

  it('should render nothing', () => {
    process.env.NODE_ENV = 'production';
    installServiceWorker();

    const { container } = render(<ServiceWorkerRegistration />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should register /sw.js at scope / with updateViaCache none in production', () => {
    process.env.NODE_ENV = 'production';
    installServiceWorker();

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });

  it.each(['development', 'test'])(
    'should not register the worker when NODE_ENV is %s',
    (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      installServiceWorker();

      render(<ServiceWorkerRegistration />);

      expect(register).not.toHaveBeenCalled();
    },
  );

  it('should not throw when the browser has no service worker support in production', () => {
    process.env.NODE_ENV = 'production';
    removeServiceWorker();
    expect('serviceWorker' in navigator).toBe(false);

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  // A rejected registration is swallowed by the component. Jest fails the test
  // on an unhandled rejection, so reaching the end of this test without one
  // is the observable proof. The macrotask flush is what lets Node report one.
  it('should swallow a rejected registration without throwing or leaking a rejection', async () => {
    process.env.NODE_ENV = 'production';
    register = jest.fn(() => Promise.reject(new Error('Registration failed')));
    installServiceWorker();

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(register).toHaveBeenCalledTimes(1);
  });
});
