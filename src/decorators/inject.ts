import {instance as globalContainer} from "../dependency-container";
import {Provider} from "../providers";
import InjectionToken from "../providers/injection-token";
import {defineInjectionTokenMetadata} from "../reflection-helpers";

/**
 * Parameter decorator factory that allows for interface information to be stored in the constructor's metadata.
 *
 * If a defaultProvider is given it will be registered into the global container.
 *
 * @return {Function} The parameter decorator
 */
function inject(
  token: InjectionToken<any>,
  defaultProvider?: Provider<any>
): (target: any, propertyKey: string | symbol, parameterIndex: number) => any {
  if (defaultProvider !== undefined) {
    globalContainer.register(token, defaultProvider as any);
  }
  return defineInjectionTokenMetadata(token);
}

export default inject;
