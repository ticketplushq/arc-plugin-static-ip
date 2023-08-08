let test = require('tape')
let { join } = require('path')
let sut = join(process.cwd(), 'src', '_get-static-ip-options')
let getStaticIpOptions = require(sut)
let _inventory = require('@architect/inventory')

test('Set up env', (t) => {
  t.plan(1)
  t.ok(getStaticIpOptions, 'static-ip options getter is present')
})

test('Specify private and public subnets', async (t) => {
  t.plan(2)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let expectedPrivateSubnets = [ '10.0.1.0/24', '10.0.2.0/24' ]
  let expectedPublicSubnets = [ '10.0.3.0/24', '10.0.4.0/24' ]
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { privateSubnets, publicSubnets } = getStaticIpOptions(arc['static-ip'])
  t.deepEqual(privateSubnets, expectedPrivateSubnets, 'Got correct private subnets')
  t.deepEqual(publicSubnets, expectedPublicSubnets, 'Got correct public subnets')
})

test('Specify vpc cidr', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
vpc-cidr 11.0.0.0/16
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { vpcCidr } = getStaticIpOptions(arc['static-ip'])
  t.equal(vpcCidr, '11.0.0.0/16', 'Got correct vpc cidr')
})

test('Get default vpc cidr', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { vpcCidr } = getStaticIpOptions(arc['static-ip'])
  t.equal(vpcCidr, '10.0.0.0/16', 'Got correct default vpc cidr')
})

test('Specify destination cidr', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
destination-cidr 1.0.10.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { destinationCidr } = getStaticIpOptions(arc['static-ip'])
  t.equal(destinationCidr, '1.0.10.0/24', 'Got correct destination cidr')
})

test('Get default destination cidr', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { destinationCidr } = getStaticIpOptions(arc['static-ip'])
  t.equal(destinationCidr, '0.0.0.0/0', 'Got correct default destination cidr')
})

test('Custom number of ip addresses', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
ip-addresses 2
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { ipAddresses } = getStaticIpOptions(arc['static-ip'])
  t.equal(ipAddresses, 2, 'Got correct ip addresses number (2)')
})

test('Default number of ip addresses', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  let { ipAddresses } = getStaticIpOptions(arc['static-ip'])
  t.equal(ipAddresses, 1, 'Got correct ip addresses number (1)')
})

test('Missing private subnets', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
public-subnets
  10.0.3.0/24
  10.0.4.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getStaticIpOptions(arc['static-ip'])
  }, {
    message: 'Invalid static ip params: Missing private subnets in @static-ip'
  }, 'private subnets param is not present')
})

test('Missing primary region', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  10.0.1.0/24
  10.0.2.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getStaticIpOptions(arc['static-ip'])
  }, {
    message: 'Invalid static ip params: Missing public subnets in @static-ip'
  }, 'public subnets param is not present')
})

test('Invalid subnets values', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
private-subnets
  0
public-subnets
  0
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getStaticIpOptions(arc['static-ip'])
  }, {
    message: 'Invalid static ip params: Invalid CIDR value (0)'
  }, 'subnets are invalid')
})

test('Invalid number of ip addresses', async (t) => {
  t.plan(1)
  let rawArc = `
@app
app
@static-ip
ip-addresses 2
private-subnets
  1.0.1.0/24
public-subnets
  1.0.2.0/24
`
  let { inv } = await _inventory({ rawArc })
  let arc = inv._project.arc
  t.throws(() => {
    getStaticIpOptions(arc['static-ip'])
  }, {
    message: 'Invalid static ip params: Number of ip addresses (2) is greater than the number of public subnets (1)'
  }, 'too many ip addresses')
})

