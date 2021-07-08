import constructor from "../types/constructor";
import {instance as globalContainer} from "../dependency-container";
import injectable from "./injectable";
import InjectionToken from "../providers/injection-token";

/**
 * Class decorator factory that registers the classes with the same token within
 * the global container.
 *
 * @return {Function} The class decorator
 */
function injectableAll<T>(token: InjectionToken<any>): (target: constructor<T>) => void {
  return function(target: constructor<T>): void {
    injectable()(target);
    globalContainer.register(token, target)
  };
}

export default injectableAll;
