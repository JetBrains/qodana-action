# Contributing

By participating in this project, you agree to abide our [Code of conduct](.github/CODE_OF_CONDUCT.md).

## Set up your machine

Qodana Scan GitHub Action and Qodana for Azure are written in [TypeScript](https://www.typescriptlang.org).

Prerequisites:

- [Node.js 12.x](https://nodejs.org/)

Other things you might need to develop:

- [WebStorm](https://www.jetbrains.com/webstorm/) (it's [free for open-source development](https://www.jetbrains.com/community/opensource/))

Clone the repository anywhere:

```sh
git clone git@github.com:JetBrains/qodana-action.git
```

Install all dependencies:

```sh
cd common && npm install && cd ../scan && npm install && cd ../vsts && npm install
```

Run everything in all subprojects:

```sh
cd scan && npm run all && cd ../vsts && npm run all && cd ../
```

### GitHub action

`cd` into the project directory (the only action available for now is Qodana Scan) and install project dependencies:

```sh
cd scan && npm install
```

Build the project:

```sh
npm run build
```

Lint your code with [ESLint](https://eslint.org/):

```sh
npm run lint
```

Run all required commands to check everything locally for the release:

```sh
npm run all
```

### Azure extension

`cd` into the project directory:

```sh
cd vsts && npm install
```

Build the project:

```sh
npm run build
```

Lint your code with [ESLint](https://eslint.org/):

```sh
npm run lint
```

Run all required commands to check everything locally for the release:

```sh
npm run all
```

Update the version – edit the following artifacts:

- [ ] [vsts/vss-extension.json](vsts/vss-extension.json)
- [ ] [vsts/QodanaScan/task.json](vsts/QodanaScan/task.json)

Test extension packing:

```sh
npm run azure-dev
```

## Create a commit

Commit messages should be well formatted, and to make that "standardized", we are using Gitmoji.

You can follow the documentation on
[their website](https://gitmoji.dev).


## Submit a pull request

Push your branch to your `qodana-action` fork and open a pull request against the
main branch.

## Release a new version

If you are a core maintainer and want to release a new version, all you need is just running the following command:

```shell
git tag -a vX.X.X -m "vX.X.X" && git push origin vX.X.X
```

And GitHub Actions will do the rest. Note that GitHub action and Azure extension are released together.