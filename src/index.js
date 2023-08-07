const getStaticIpOptions = require('./_get-static-ip-options')
const getLogicalID = require('./_get-logical-id')

const maxZones = 6

module.exports = {
  deploy: {
    start: async ({ arc, cloudformation, inventory }) => {
      const cfn = cloudformation
      const staticIp = arc['static-ip']
      if (!staticIp) return cfn

      const { privateSubnets, publicSubnets, ips, vpcCidr, destinationCidr } = getStaticIpOptions(staticIp)

      cfn.Resources['VPC'] = {
        Type: 'AWS::EC2::VPC',
        Properties: {
          CidrBlock: vpcCidr,
          EnableDnsSupport: true,
          EnableDnsHostnames: true,
        }
      }

      cfn.Resources['DefaultSecurityGroup'] = {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: `VPC default security group for ${arc.app[0]}`,
          VpcId: { Ref: 'VPC' }
        }
      }

      cfn.Resources['InternetGateway'] = {
        Type: 'AWS::EC2::InternetGateway',
        Properties: {}
      }

      cfn.Resources['AttachGateway'] = {
        Type: 'AWS::EC2::VPCGatewayAttachment',
        Properties: {
          VpcId: { Ref: 'VPC' },
          InternetGatewayId: { Ref: 'InternetGateway' }
        }
      }

      cfn.Resources['PublicRouteTable'] = {
        Type: 'AWS::EC2::RouteTable',
        Properties: {
          VpcId: { Ref: 'VPC' }
        }
      }

      cfn.Resources['PrivateRouteTable'] = {
        Type: 'AWS::EC2::RouteTable',
        Properties: {
          VpcId: { Ref: 'VPC' }
        }
      }

      cfn.Resources['PublicRoute'] = {
        Type: 'AWS::EC2::Route',
        Properties: {
          RouteTableId: { Ref: 'PublicRouteTable' },
          DestinationCidrBlock: destinationCidr,
          GatewayId: { Ref: 'InternetGateway' }
        },
        DependsOn: 'AttachGateway'
      }

      for (let index = 0; index < ips; index++) {
        cfn.Resources[`ElasticIp${index + 1}`] = {
          Type: 'AWS::EC2::EIP',
          Properties: {
            Domain: 'vpc'
          }
        }

        cfn.Resources[`NatGateway${index + 1}`] = {
          Type: 'AWS::EC2::NatGateway',
          Properties: {
            AllocationId: { 'Fn::GetAtt': [ `ElasticIp${index + 1}`, 'AllocationId' ] },
            SubnetId: { Ref: `PublicSubnet${index + 1}` }
          }
        }
      }

      privateSubnets.forEach((cidr, index) => {
        cfn.Resources[`PrivateSubnet${index + 1}`] = {
          Type: 'AWS::EC2::Subnet',
          Properties: {
            VpcId: { Ref: 'VPC' },
            CidrBlock: cidr,
            AvailabilityZone: { 'Fn::Select': [ index % maxZones, { 'Fn::GetAZs': '' } ] },
            MapPublicIpOnLaunch: true
          }
        }

        cfn.Resources[`PrivateSubnet${index + 1}RouteTableAssociation`] = {
          Type: 'AWS::EC2::SubnetRouteTableAssociation',
          Properties: {
            SubnetId: { Ref: `PrivateSubnet${index + 1}` },
            RouteTableId: { Ref: 'PrivateRouteTable' }
          }
        }
      })

      publicSubnets.forEach((cidr, index) => {
        cfn.Resources[`PublicSubnet${index + 1}`] = {
          Type: 'AWS::EC2::Subnet',
          Properties: {
            VpcId: { Ref: 'VPC' },
            CidrBlock: cidr,
            AvailabilityZone: { 'Fn::Select': [ index % maxZones, { 'Fn::GetAZs': '' } ] },
            MapPublicIpOnLaunch: true
          }
        }

        cfn.Resources[`PublicSubnet${index + 1}RouteTableAssociation`] = {
          Type: 'AWS::EC2::SubnetRouteTableAssociation',
          Properties: {
            SubnetId: { Ref: `PublicSubnet${index + 1}` },
            RouteTableId: { Ref: 'PublicRouteTable' }
          }
        }
      })

      const privateSubnetsIds = privateSubnets.map((_, index) => ({ 'Fn::GetAtt': [ `PrivateSubnet${index + 1}`, 'SubnetId' ] }))
      const lambdas = Object.values(inventory.inv.lambdasBySrcDir)
      lambdas.forEach(({ src }) => {
        let logicalID = getLogicalID(inventory, src)
        cfn.Resources[logicalID]['Properties']['VpcConfig'] = {
          SecurityGroupIds: [ { 'Fn::GetAtt': [ 'DefaultSecurityGroup', 'GroupId' ] } ],
          SubnetIds: privateSubnetsIds
        }
      })

      return cfn
    }
  }
}
