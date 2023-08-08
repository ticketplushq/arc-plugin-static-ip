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

      cfn.Resources.Role.Properties.Policies.push({
        PolicyName: 'ArcVPCPolicy',
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'ec2:DescribeNetworkInterfaces',
                'ec2:CreateNetworkInterface',
                'ec2:DeleteNetworkInterface',
                'ec2:DescribeInstances',
                'ec2:AttachNetworkInterface'
              ],
              Resource: '*'
            }
          ]
        }
      })

      cfn.Resources['VPC'] = {
        Type: 'AWS::EC2::VPC',
        Properties: {
          CidrBlock: vpcCidr,
          EnableDnsSupport: true,
          EnableDnsHostnames: true,
          Tags: [
            { Key: 'Name', Value: { Ref: 'AWS::StackName' } }
          ]
        }
      }

      cfn.Resources['DefaultSecurityGroup'] = {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: `VPC default security group for ${arc.app[0]}`,
          VpcId: { Ref: 'VPC' },
          Tags: [
            { Key: 'Name', Value: { 'Fn::Join': [ '-', [ { Ref: 'AWS::StackName' }, 'default' ] ] } }
          ]
        }
      }

      cfn.Resources['InternetGateway'] = {
        Type: 'AWS::EC2::InternetGateway',
        Properties: {
          Tags: [
            { Key: 'Name', Value: { 'Fn::Join': [ '-', [ { Ref: 'AWS::StackName' }, 'gateway' ] ] } }
          ]
        }
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
            Domain: 'vpc',
            Tags: [
              { Key: 'Name', Value: { 'Fn::Join': [ '-', [ { Ref: 'AWS::StackName' }, 'eip', index + 1 ] ] } }
            ]
          }
        }

        cfn.Resources[`NatGateway${index + 1}`] = {
          Type: 'AWS::EC2::NatGateway',
          Properties: {
            AllocationId: { 'Fn::GetAtt': [ `ElasticIp${index + 1}`, 'AllocationId' ] },
            SubnetId: { Ref: `PublicSubnet${index + 1}` }
          }
        }

        cfn.Resources[`PrivateRoute${index + 1}`] = {
          Type: 'AWS::EC2::Route',
          Properties: {
            RouteTableId: { Ref: 'PrivateRouteTable' },
            DestinationCidrBlock: destinationCidr,
            NatGatewayId: { Ref: `NatGateway${index + 1}` }
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
            MapPublicIpOnLaunch: true,
            Tags: [
              { Key: 'Name', Value: { 'Fn::Join': [ '-', [ { Ref: 'AWS::StackName' }, 'private-subnet', index + 1 ] ] } }
            ]
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
            MapPublicIpOnLaunch: true,
            Tags: [
              { Key: 'Name', Value: { 'Fn::Join': [ '-', [ { Ref: 'AWS::StackName' }, 'public-subnet', index + 1 ] ] } }
            ]
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
