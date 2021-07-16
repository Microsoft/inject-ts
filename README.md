[![Travis](https://img.shields.io/travis/Microsoft/tsyringe.svg)](https://travis-ci.org/Microsoft/tsyringe/)
[![npm](https://img.shields.io/npm/v/tsyringe.svg)](https://www.npmjs.com/package/tsyringe)
[![npm](https://img.shields.io/npm/dt/tsyringe.svg)](https://www.npmjs.com/package/tsyringe)

# TSyringe

A lightweight dependency injection container for TypeScript/JavaScript for
constructor injection.

<!-- TOC depthFrom:1 depthTo:3 -->

- [TSyringe](#tsyringe)
  - [Installation](#installation)
- [API](#api)
  - [Decorators](#decorators)
    - [injectable()](#injectable)
    - [singleton()](#singleton)
    - [autoInjectable()](#autoinjectable)
    - [inject()](#inject)
    - [injectAll()](#injectall)
    - [injectWithTransform()](#injectWithTransform)
    - [injectAllWithTransform()](#injectAllWithTransform)
    - [scoped()](#scoped)
  - [Container](#container)
    - [Injection Token](#injection-token)
    - [Providers](#providers)
    - [Register](#register)
    - [Registry](#registry)
    - [Resolution](#resolution)
    - [Interception](#interception)
    - [Child Containers](#child-containers)
    - [Clearing Instances](#clearing-instances)
- [Circular dependencies](#circular-dependencies)
  - [The `delay` helper function](#the-delay-helper-function)
  - [Interfaces and circular dependencies](#interfaces-and-circular-dependencies)
- [Full examples](#full-examples)
  - [Example without interfaces](#example-without-interfaces)
  - [Example with interfaces](#example-with-interfaces)
  - [Injecting primitive values (Named injection)](#injecting-primitive-values-named-injection)
- [Non goals](#non-goals)
- [Contributing](#contributing)

<!-- /TOC -->

## Installation

Install by `npm`

```sh
npm install --save tsyringe
```

**or** install with `yarn` (this project is developed using `yarn`)

```sh
yarn add tsyringe
```

Modify your `tsconfig.json` to include the following settings

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Add a polyfill for the Reflect API (examples below use reflect-metadata). You can use:

- [reflect-metadata](https://www.npmjs.com/package/reflect-metadata)
- [core-js (core-js/proposals/reflect-metadata)](https://www.npmjs.com/package/core-js)
- [reflection](https://www.npmjs.com/package/@abraham/reflection)

The Reflect polyfill import should only be added once, and before DI is used:

```typescript
// main.ts
import "reflect-metadata";

// Your code here...
```

### Babel

If you're using Babel (e.g. using React Native), you will need to configure it to emit TypeScript metadata.

First get the Babel plugin

#### Yarn

```
yarn add --dev babel-plugin-transform-typescript-metadata
```

#### npm

```
npm install --save-dev babel-plugin-transform-typescript-metadata
```

Then add it to your Babel config

```
plugins: [
            'babel-plugin-transform-typescript-metadata',
            /* ...the rest of your config... */
         ]
```

# API

TSyringe performs [Constructor Injection](https://en.wikipedia.org/wiki/Dependency_injection#Constructor_injection)
on the constructors of decorated classes.

## Decorators

### injectable()

Class decorator factory that allows the class' dependencies to be injected at
runtime. TSyringe relies on several decorators in order to collect metadata about classes
to be instantiated.

#### Usage

```typescript
import {injectable} from "tsyringe";

@injectable()
class Foo {
  constructor(private database: Database) {}
}

// some other file
import "reflect-metadata";
import {container} from "tsyringe";
import {Foo} from "./foo";

const instance = container.resolve(Foo);
```

### singleton()

Class decorator factory that registers the class as a singleton within the
global container.

#### Usage

```typescript
import {singleton} from "tsyringe";

@singleton()
class Foo {
  constructor() {}
}

// some other file
import "reflect-metadata";
import {container} from "tsyringe";
import {Foo} from "./foo";

const instance = container.resolve(Foo);
```

### autoInjectable()

Class decorator factory that replaces the decorated class' constructor with
a parameterless constructor that has dependencies auto-resolved.

**Note** Resolution is performed using the global container.

#### Usage

```typescript
import {autoInjectable} from "tsyringe";

@autoInjectable()
class Foo {
  constructor(private database?: Database) {}
}

// some other file
import {Foo} from "./foo";

const instance = new Foo();
```

Notice how in order to allow the use of the empty constructor `new Foo()`, we
need to make the parameters optional, e.g. `database?: Database`.

### inject()

Parameter decorator factory that allows for interface and other non-class
information to be stored in the constructor's metadata.

#### Usage

```typescript
import {injectable, inject} from "tsyringe";

interface Database {
  // ...
}

@injectable()
class Foo {
  constructor(@inject("Database") private database?: Database) {}
}
```

### injectAll()

Parameter decorator for array parameters where the array contents will come from the container.
It will inject an array using the specified injection token to resolve the values.

#### Usage

```typescript
import {injectable, injectAll} from "tsyringe";

@injectable
class Foo {}

@injectable
class Bar {
  constructor(@injectAll(Foo) fooArray: Foo[]) {
    // ...
  }
}
```

### injectWithTransform

Parameter decorator which allows for a transformer object to take an action on the resolved object
before returning the result.

```typescript
class FeatureFlags {
  public getFlagValue(flagName: string): boolean {
    // ...
}

class Foo() {}

class FeatureFlagsTransformer implements Transform<FeatureFlags, bool> {
  public transform(flags: FeatureFlags, flag: string) {
    return flags.getFlagValue(flag);
  }
}

@injectable()
class MyComponent(foo: Foo, @injectWithTransform(FeatureFlags, FeatureFlagsTransformer, "IsBlahEnabled") blahEnabled: boolean){
  // ...
}
```

### injectAllWithTransform

This parameter decorator allows for array contents to be passed through a transformer. The transformer can return any type, so this
can be used to map or fold an array.

```typescript
@injectable
class Foo {
  public value;
}

class FooTransform implements Transform<Foo[], string[]>{
  public transform(foos: Foo[]): string[]{
    return foos.map(f => f.value));
  }
}

@injectable
class Bar {
  constructor(@injectAllWithTransform(Foo, FooTransform) stringArray: string[]) {
    // ...
  }
}
```

### scoped()

Class decorator factory that registers the class as a scoped dependency within the global container.

#### Available scopes

- Transient
  - The **default** registration scope, a new instance will be created with each resolve
- Singleton
  - Each resolve will return the same instance (including resolves from child containers)
- ResolutionScoped
  - The same instance will be resolved for each resolution of this dependency during a single
    resolution chain
- ContainerScoped
  - The dependency container will return the same instance each time a resolution for this dependency
    is requested. This is similar to being a singleton, however if a child container is made, that child
    container will resolve an instance unique to it.

#### Usage

```typescript
@scoped(Lifecycle.ContainerScoped)
class Foo {}
```

## Container

The general principle behind [Inversion of Control](https://en.wikipedia.org/wiki/Inversion_of_control) (IoC) containers
is you give the container a _token_, and in exchange you get an instance/value. Our container automatically figures out the tokens most of the time, with 2 major exceptions, interfaces and non-class types, which require the `@inject()` decorator to be used on the constructor parameter to be injected (see above).

In order for your decorated classes to be used, they need to be registered with the container. Registrations take the
form of a Token/Provider pair, so we need to take a brief diversion to discuss tokens and providers.

### Injection Token

A token may be either a string, a symbol, a class constructor, or a instance of [`DelayedConstructor`](#circular-dependencies).

```typescript
type InjectionToken<T = any> =
  | constructor<T>
  | DelayedConstructor<T>
  | string
  | symbol;
```

### Providers

Our container has the notion of a _provider_. A provider is registered with the DI
container and provides the container the information
needed to resolve an instance for a given token. In our implementation, we have the following 4
provider types:

#### Class Provider

```TypeScript
{
  token: InjectionToken<T>;
  useClass: constructor<T>;
}
```

This provider is used to resolve classes by their constructor. When registering a class provider
you can simply use the constructor itself, unless of course you're making an alias (a
class provider where the token isn't the class itself).

#### Value Provider

```TypeScript
{
  token: InjectionToken<T>;
  useValue: T
}
```

This provider is used to resolve a token to a given value. This is useful for registering
constants, or things that have a already been instantiated in a particular way.

#### Factory provider

```TypeScript
{
  token: InjectionToken<T>;
  useFactory: FactoryFunction<T>;
}
```

This provider is used to resolve a token using a given factory. The factory has full access
to the dependency container.

We have provided 2 factories for you to use, though any function that matches the `FactoryFunction<T>` signature
can be used as a factory:

```typescript
type FactoryFunction<T> = (dependencyContainer: DependencyContainer) => T;
```

##### instanceCachingFactory

This factory is used to lazy construct an object and cache result, returning the single instance for each subsequent
resolution. This is very similar to `@singleton()`

```typescript
import {instanceCachingFactory} from "tsyringe";

{
  token: "SingletonFoo";
  useFactory: instanceCachingFactory<Foo>(c => c.resolve(Foo));
}
```

##### instancePerContainerCachingFactory

This factory is used to lazy construct an object and cache result per `DependencyContainer`, returning the single instance for each subsequent
resolution from a single container. This is very similar to `@scoped(Lifecycle.ContainerScoped)`

```typescript
import {instancePerContainerCachingFactory} from "tsyringe";

{
  token: "ContainerScopedFoo";
  useFactory: instancePerContainerCachingFactory<Foo>(c => c.resolve(Foo));
}
```

##### predicateAwareClassFactory

This factory is used to provide conditional behavior upon resolution. It caches the result by default, but
has an optional parameter to resolve fresh each time.

```typescript
import {predicateAwareClassFactory} from "tsyringe";

{
  token: useFactory: predicateAwareClassFactory<Foo>(
    c => c.resolve(Bar).useHttps, // Predicate for evaluation
    FooHttps, // A FooHttps will be resolved from the container if predicate is true
    FooHttp // A FooHttp will be resolved if predicate is false
  );
}
```

#### Token Provider

```TypeScript
{
  token: InjectionToken<T>;
  useToken: InjectionToken<T>;
}
```

This provider can be thought of as a redirect or an alias, it simply states that given token _x_,
resolve using token _y_.

### Register

The normal way to achieve this is to add `DependencyContainer.register()` statements somewhere
in your program some time before your first decorated class is instantiated.

```typescript
container.register<Foo>(Foo, {useClass: Foo});
container.register<Bar>(Bar, {useValue: new Bar()});
container.register<Baz>("MyBaz", {useValue: new Baz()});
```

#### Registration options

As an optional parameter to `.register()` you may provide [`RegistrationOptions`](./src/types/registration-options.ts)
which customize how the registration behaves. See the linked source code for up to date documentation
on available options.

### Registry

You can also mark up any class with the `@registry()` decorator to have the given providers registered
upon importing the marked up class. `@registry()` takes an array of providers like so:

```TypeScript
@registry([
  { token: Foobar, useClass: Foobar },
  { token: "theirClass", useFactory: (c) => {
       return new TheirClass( "arg" )
    },
  }
])
class MyClass {}
```

This is useful when you want to [register multiple classes for the same token](#register).
You can also use it to register and declare objects that wouldn't be imported by anything else,
such as more classes annotated with `@registry` or that are otherwise responsible for registering objects.
Lastly you might choose to use this to register 3rd party instances instead of the `container.register(...)` method.
note: if you want this class to be `@injectable` you must put the decorator before `@registry`, this annotation is not
required though.

### Resolution

Resolution is the process of exchanging a token for an instance. Our container will recursively fulfill the
dependencies of the token being resolved in order to return a fully constructed object.

The typical way that an object is resolved is from the container using `resolve()`.

```typescript
const myFoo = container.resolve(Foo);
const myBar = container.resolve<Bar>("Bar");
```

You can also resolve all instances registered against a given token with `resolveAll()`.

```typescript
interface Bar {}

@injectable()
class Foo implements Bar {}
@injectable()
class Baz implements Bar {}

@registry([
  // registry is optional, all you need is to use the same token when registering
  {token: "Bar", useToken: Foo}, // can be any provider
  {token: "Bar", useToken: Baz}
])
class MyRegistry {}

const myBars = container.resolveAll<Bar>("Bar"); // myBars type is Bar[]
```

### Interception

Interception allows you to register a callback that will be called before or after the resolution of a specific token.
This callback can be registered to execute only once (to perform initialization, for example),
on each resolution to do logging, for example.

`beforeResolution` is used to take an action before an object is resolved.

```typescript
class Bar {}

container.beforeResolution(
  Bar,
  // Callback signature is (token: InjectionToken<T>, resolutionType: ResolutionType) => void
  () => {
    console.log("Bar is about to be resolved!");
  },
  {frequency: "Always"}
);
```

`afterResolution` is used to take an action after the object has been resolved.

```typescript
class Bar {
  public init(): void {
    // ...
  }
}

container.afterResolution(
  Bar,
  // Callback signature is (token: InjectionToken<T>, result: T | T[], resolutionType: ResolutionType)
  (_t, result) => {
    result.init();
  },
  {frequency: "Once"}
);
```

### Child Containers

If you need to have multiple containers that have disparate sets of registrations, you can create child containers:

```typescript
const childContainer1 = container.createChildContainer();
const childContainer2 = container.createChildContainer();
const grandChildContainer = childContainer1.createChildContainer();
```

Each of the child containers will have independent registrations, but if a registration is absent in the child container at resolution, the token will be resolved from the parent. This allows for a set of common services to be registered at the root, with specialized services registered on the child. This can be useful, for example, if you wish to create per-request containers that use common stateless services from the root container.

### Clearing Instances

The `container.clearInstances()` method allows you to clear all previously created and registered instances:

```typescript
class Foo {}
@singleton()
class Bar {}

const myFoo = new Foo();
container.registerInstance("Test", myFoo);
const myBar = container.resolve(Bar);

container.clearInstances();

container.resolve("Test"); // throws error
const myBar2 = container.resolve(Bar); // myBar !== myBar2
const myBar3 = container.resolve(Bar); // myBar2 === myBar3
```

Unlike with `container.reset()`, the registrations themselves are not cleared.
This is especially useful for testing:

```typescript
@singleton()
class Foo {}

beforeEach(() => {
  container.clearInstances();
});

test("something", () => {
  container.resolve(Foo); // will be a new singleton instance in every test
});
```

# Circular dependencies

Sometimes you need to inject services that have cyclic dependencies between them. As an example:

```typescript
@injectable()
export class Foo {
  constructor(public bar: Bar) {}
}

@injectable()
export class Bar {
  constructor(public foo: Foo) {}
}
```

Trying to resolve one of the services will end in an error because always one of the constructor will not be fully defined to construct the other one.

```typescript
container.resolve(Foo);
```

```
Error: Cannot inject the dependency at position #0 of "Foo" constructor. Reason:
    Attempted to construct an undefined constructor. Could mean a circular dependency problem. Try using `delay` function.
```

### The `delay` helper function

The best way to deal with this situation is to do some kind of refactor to avoid the cyclic dependencies. Usually this implies introducing additional services to cut the cycles.

But when refactor is not an option you can use the `delay` function helper. The `delay` function wraps the constructor in an instance of `DelayedConstructor`.

The _delayed constructor_ is a kind of special `InjectionToken` that will eventually be evaluated to construct an intermediate proxy object wrapping a factory for the real object.

When the proxy object is used for the first time it will construct a real object using this factory and any usage will be forwarded to the real object.

```typescript
@injectable()
export class Foo {
  constructor(@inject(delay(() => Bar)) public bar: Bar) {}
}

@injectable()
export class Bar {
  constructor(@inject(delay(() => Foo)) public foo: Foo) {}
}

// construction of foo is possible
const foo = container.resolve(Foo);

// property bar will hold a proxy that looks and acts as a real Bar instance.
foo.bar instanceof Bar; // true
```

### Interfaces and circular dependencies

We can rest in the fact that a `DelayedConstructor` could be used in the same contexts that a constructor and will be handled transparently by tsyringe. Such idea is used in the next example involving interfaces:

```typescript
export interface IFoo {}

@injectable()
@registry([
  {
    token: "IBar",
    // `DelayedConstructor` of Bar will be the token
    useToken: delay(() => Bar)
  }
])
export class Foo implements IFoo {
  constructor(@inject("IBar") public bar: IBar) {}
}
export interface IBar {}

@injectable()
@registry([
  {
    token: "IFoo",
    useToken: delay(() => Foo)
  }
])
export class Bar implements IBar {
  constructor(@inject("IFoo") public foo: IFoo) {}
}
```

# Full examples

## Example without interfaces

Since classes have type information at runtime, we can resolve them without any
extra information.

```typescript
// Foo.ts
export class Foo {}
```

```typescript
// Bar.ts
import {Foo} from "./Foo";
import {injectable} from "tsyringe";

@injectable()
export class Bar {
  constructor(public myFoo: Foo) {}
}
```

```typescript
// main.ts
import "reflect-metadata";
import {container} from "tsyringe";
import {Bar} from "./Bar";

const myBar = container.resolve(Bar);
// myBar.myFoo => An instance of Foo
```

## Example with interfaces

Interfaces don't have type information at runtime, so we need to decorate them
with `@inject(...)` so the container knows how to resolve them.

```typescript
// SuperService.ts
export interface SuperService {
  // ...
}
```

```typescript
// TestService.ts
import {SuperService} from "./SuperService";
export class TestService implements SuperService {
  //...
}
```

```typescript
// Client.ts
import {injectable, inject} from "tsyringe";

@injectable()
export class Client {
  constructor(@inject("SuperService") private service: SuperService) {}
}
```

```typescript
// main.ts
import "reflect-metadata";
import {Client} from "./Client";
import {TestService} from "./TestService";
import {container} from "tsyringe";

container.register("SuperService", {
  useClass: TestService
});

const client = container.resolve(Client);
// client's dependencies will have been resolved
```

## Injecting primitive values (Named injection)

Primitive values can also be injected by utilizing named injection

```typescript
import {singleton, inject} from "tsyringe";

@singleton()
class Foo {
  private str: string;
  constructor(@inject("SpecialString") value: string) {
    this.str = value;
  }
}

// some other file
import "reflect-metadata";
import {container} from "tsyringe";
import {Foo} from "./foo";

const str = "test";
container.register("SpecialString", {useValue: str});

const instance = container.resolve(Foo);
```

# Non goals

The following is a list of features we explicitly plan on not adding:

- Property Injection

# Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit [https://cla.microsoft.com](https://cla.microsoft.com).

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
