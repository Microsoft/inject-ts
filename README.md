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
    - [scoped()](#scoped)
  - [Container](#container)
    - [Injection Token](#injection-token)
    - [Providers](#providers)
    - [Register](#register)
    - [Registry](#registry)
    - [Resolution](#resolution)
    - [Child Containers](#child-containers)
- [Full examples](#full-examples)
  - [Example without interfaces](#example-without-interfaces)
  - [Example with interfaces](#example-with-interfaces)
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
- [core-js (core-js/es7/reflect)](https://www.npmjs.com/package/core-js)
- [reflection](https://www.npmjs.com/package/@abraham/reflection)

The Reflect polyfill import should only be added once, and before before DI is used:

```typescript
// main.ts
import "reflect-metadata";

// Your code here...
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

If nothing is registered for the specified token and the token is a string or a symbol, it will inject an empty array.
If nothing is registered for the specified token and the token is a class constructor, it will inject an array
with a single instance of the class.

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

### scoped()

Class decorator factory that registers the class as a scoped dependency within the global container.

#### Available scopes
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

A token may be either a string, a symbol, or a class constructor.

```typescript
type InjectionToken<T = any> = constructor<T> | string | symbol;
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
  useFactory: instanceCachingFactory<Foo>(c => c.resolve(Foo))
}
```

##### predicateAwareClassFactory

This factory is used to provide conditional behavior upon resolution. It caches the result by default, but 
has an optional parameter to resolve fresh each time.

```typescript
import {predicateAwareClassFactory} from "tsyringe";

{
  token: 
  useFactory: predicateAwareClassFactory<Foo>(
    c => c.resolve(Bar).useHttps,
    FooHttps, // A FooHttps will be resolved from the container
    FooHttp
  )
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

### Registry

You can also mark up any class with the `@registry()` decorator to have the given providers registered
upon importing the marked up class. `@registry()` takes an array of providers like so:

```TypeScript
@injectable()
@registry([
  Foo,
  Bar,
  {
    token: "IFoobar",
    useClass: MockFoobar
  }
])
class MyClass {}
```

This is useful when you don't control the entry point for your code (e.g. being instantiated by a framework), and need
an opportunity to do registration. Otherwise, it's preferable to use `.register()`. **Note** the `@injectable()` decorator
must precede the `@registry()` decorator, since TypeScript executes decorators inside out.

### Resolution

Resolution is the process of exchanging a token for an instance. Our container will recursively fulfill the
dependencies of the token being resolved in order to return a fully constructed object.

The typical way that an object is resolved is from the container using `resolve()`.

```typescript
const myFoo = container.resolve(Foo);
const myBar = container.resolve<Bar>("Bar");
```

You can also resolve all instances registered against a given token with `**`resolveAll(`**)`.

```typescript
interface Bar {}

@injectable()
class Foo implements Bar {}
@injectable()
class Baz implements Bar {}

@registry([ // registry is optional, all you need is to use the same token when registering
  { token: 'Bar', useToken: Foo }, // can be any provider
  { token: 'Bar', useToken: Baz },
])
class MyRegistry {}

const myBars = container.resolveAll<Bar>("Bar"); // myBars type is Bar[]
```
### Child Containers
If you need to have multiple containers that have disparate sets of registrations, you can create child containers

```typescript
const childContainer1 = container.createChildContainer();
const childContainer2 = container.createChildContainer();
const grandChildContainer = childContainer1.createChildContainer();
```
Each of the child containers will have independent registrations, but if a registration is absent in the child container at resolution, the token will be resolved from the parent. This allows for a set of common services to be registered at the root, with specialized services registered on the child. This can be useful, for example, if you wish to create per-request containers that use common stateless services from the root container.

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
