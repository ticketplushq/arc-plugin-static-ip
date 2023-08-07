const validateCidr = (cidr) => {
  const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
  if (!cidrRegex.test(cidr)) {
    throw TypeError(`Invalid static ip params: Invalid CIDR value (${cidr})`)
  }
}

module.exports = (staticIp) => {
  let privateSubnets = []
  let publicSubnets = []
  let ips = 1

  if (staticIp) {
    const privateIndex = staticIp.findIndex((param) => param['private-subnets'])
    if (privateIndex >= 0) {
      privateSubnets = privateSubnets.concat(staticIp[privateIndex]['private-subnets'])
      privateSubnets.forEach(validateCidr)
    }
    else {
      throw ReferenceError('Invalid static ip params: Missing private subnets in @static-ip')
    }

    const publicIndex = staticIp.findIndex((param) => param['public-subnets'])
    if (publicIndex >= 0) {
      publicSubnets = publicSubnets.concat(staticIp[publicIndex]['public-subnets'])
      publicSubnets.forEach(validateCidr)
    }
    else {
      throw ReferenceError('Invalid static ip params: Missing public subnets in @static-ip')
    }

    const ipsIndex = staticIp.findIndex((param) => Array.isArray(param) && param[0] == 'ips')
    if (ipsIndex >= 0) {
      ips = staticIp[ipsIndex][1]
      if (publicSubnets.length < ips) {
        throw ReferenceError(`Invalid static ip params: Number of ips (${ips}) is greater than the number of public subnets (${publicSubnets.length})`)
      }
    }
  }

  return {
    privateSubnets,
    publicSubnets,
    ips
  }
}
