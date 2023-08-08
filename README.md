# @ticketplushq/arc-plugin-static-ip

[![Build](https://github.com/ticketplushq/arc-plugin-static-ip/actions/workflows/build.yaml/badge.svg)](https://github.com/ticketplushq/arc-plugin-static-ip/actions/workflows/build.yaml)

This plugin allows setting a static outgoing IP in an architect project

## Table of contents

- [Install](#install)
- [Usage](#usage)
  - [The `@static-ip` pragma](#the-static-ip-pragma)
- [Contributing](#contributing)
- [License](#license)

## Install

`npm i @ticketplushq/arc-plugin-static-ip`

Add this line to your Architect project manifest:

```arc
# app.arc
@plugins
ticketplushq/arc-plugin-static-ip
```

Then follow the directions below for `@static-ip`.

## Usage

### The `@static-ip` pragma

The `@static-ip` pragma allows you to configure the network configuration.

- The `ip-addresses` entry allow you to define number of ips
  * The default value is `1`
- The `private-subnets` entry allow you to define each private subnet cidr
- The `public-subnets` entry allow you to define each public subnet cidr
- The `vpc-cidr` entry allow to define vpc cidr
  * The default value is `10.0.0.0/16`
- The `destination-cidr` entry allow to define destination cidr for public route table
  * The default value is `0.0.0.0/0`

#### Example for a VPC with 2 static IP addresses

```
# app.arc
@static-ip
ip-addresses 2
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
```

## Maintainer

[@ticketplushq](https://github.com/ticketplushq)

## Contributing

Feel free to dive in! Open an issue or submit PRs.

## License

Apache License 2.0 © 2023 Ticketplus
