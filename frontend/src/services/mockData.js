export const initialProducts = [
  {
    id: 1,
    name: 'ScaleFlow Quantum Node X9000',
    description: 'Dual 128-core ARM architecture server optimized for event streaming and high-concurrency microservice workloads.',
    price: 4999.99,
    stock: 25,
    sku: 'HW-NODE-X9000',
    category_id: 1,
    active: true
  },
  {
    id: 2,
    name: 'Kafka Event Acceleration Unit',
    description: 'PCIe 5.0 hardware offload engine for zero-copy partition log serialization and sub-millisecond event throughput.',
    price: 2499.50,
    stock: 14,
    sku: 'HW-KAFKA-ACCEL',
    category_id: 3,
    active: true
  },
  {
    id: 3,
    name: 'PostgreSQL Row-Lock SSD Cluster 4TB',
    description: 'NVMe Gen5 Enterprise SSD array with hardware-level ACID transactional write buffers and row lock acceleration.',
    price: 1850.00,
    stock: 30,
    sku: 'STOR-NVME-4TB',
    category_id: 2,
    active: true
  },
  {
    id: 4,
    name: 'Redis Sliding-Window Rate Limiter Appliance',
    description: 'Dedicated 100GbE network appliance for sub-microsecond rate limiting, token buckets, and distributed session caching.',
    price: 3200.00,
    stock: 8,
    sku: 'NET-REDIS-LIMIT',
    category_id: 4,
    active: true
  },
  {
    id: 5,
    name: 'ScaleFlow Gateway Mesh Switch 64-Port',
    description: 'Ultra-low latency 400Gbps L4/L7 API gateway load balancing switch with automated SSL termination.',
    price: 6800.00,
    stock: 5,
    sku: 'NET-GATEWAY-64P',
    category_id: 4,
    active: true
  },
  {
    id: 6,
    name: 'Saga Compensating Event Monitor Hub',
    description: 'Hardware telemetry engine dedicated to distributed Saga transaction state tracking and automated stock rollbacks.',
    price: 1299.99,
    stock: 18,
    sku: 'HW-SAGA-MON',
    category_id: 3,
    active: true
  },
  {
    id: 7,
    name: 'Enterprise Edge Micro-Server Tower',
    description: 'Compact silent server chassis with redundant power supplies and remote IPMI telemetry management.',
    price: 1450.00,
    stock: 40,
    sku: 'HW-EDGE-TOWER',
    category_id: 1,
    active: true
  },
  {
    id: 8,
    name: 'Dead Letter Queue Storage Module 2TB',
    description: 'High-endurance SLC NAND flash module engineered for persistent DLQ message retention and audit logging.',
    price: 899.00,
    stock: 22,
    sku: 'STOR-DLQ-2TB',
    category_id: 2,
    active: true
  }
];

export const initialCategories = [
  { id: 1, name: 'Compute & Edge Servers' },
  { id: 2, name: 'High-Speed Storage Arrays' },
  { id: 3, name: 'Kafka Event Brokers' },
  { id: 4, name: 'Cloud Load Balancers' }
];
