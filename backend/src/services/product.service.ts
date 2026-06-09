import type { z } from "zod";
import { ProductRepository } from "../repositories/product.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import type { clientProductSchema, productServiceSchema } from "../validations/entities.validation.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

type ProductInput = z.infer<typeof productServiceSchema>;
type ClientProductInput = z.infer<typeof clientProductSchema>;

export class ProductService {
  public constructor(
    private readonly repository = new ProductRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public list(userId: string, query: ListQuery) {
    return this.repository.list(userId, query);
  }

  public insights(userId: string) {
    return this.repository.insights(userId);
  }

  public async get(id: string, userId: string) {
    const product = await this.repository.findById(id, userId);
    if (!product) throw new ApiError(404, "Produto ou servico nao encontrado.");
    return product;
  }

  public async create(input: ProductInput, userId: string) {
    const product = await this.repository.create({ ...input, owner: { connect: { id: userId } } });
    await this.auditRepository.log({ userId, entity: "ProductService", entityId: product.id, action: "CREATED" });
    return product;
  }

  public async update(id: string, input: ProductInput, userId: string) {
    await this.get(id, userId);
    const product = await this.repository.update(id, input);
    await this.auditRepository.log({ userId, entity: "ProductService", entityId: id, action: "UPDATED" });
    return product;
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.repository.delete(id);
    await this.auditRepository.log({ userId, entity: "ProductService", entityId: id, action: "DELETED" });
  }

  public listClientProducts(userId: string, query: ListQuery, clientId?: string) {
    return this.repository.listClientProducts(userId, query, clientId);
  }

  public async createClientProduct(input: ClientProductInput, userId: string) {
    const { clientId, productId, ...data } = input;
    const clientProduct = await this.repository.createClientProduct({
      ...data,
      owner: { connect: { id: userId } },
      client: { connect: { id: clientId } },
      product: { connect: { id: productId } }
    });
    await this.auditRepository.log({ userId, clientId, entity: "ClientProduct", entityId: clientProduct.id, action: "CREATED" });
    if (input.renewalDate) await this.createRenewalFollowUp(clientProduct.id, input, userId);
    return clientProduct;
  }

  private async createRenewalFollowUp(entityId: string, input: ClientProductInput, userId: string): Promise<void> {
    if (!input.renewalDate) return;
    const startAt = new Date(input.renewalDate);
    startAt.setDate(startAt.getDate() - 7);
    startAt.setHours(9, 0, 0, 0);
    if (startAt < new Date()) return;
    const endAt = new Date(startAt);
    endAt.setHours(startAt.getHours() + 1);
    await this.repository.createRenewalFollowUp({
      user: { connect: { id: userId } },
      client: { connect: { id: input.clientId } },
      title: "Follow-up de renovacao",
      type: "FOLLOW_UP",
      description: `Renovacao do produto contratado. Vinculo: ${entityId}`,
      startAt,
      endAt,
      allDay: false,
      status: "SCHEDULED",
      color: "#10B981"
    });
  }

  public async updateClientProduct(id: string, input: ClientProductInput, userId: string) {
    const existing = await this.repository.findClientProduct(id, userId);
    if (!existing) throw new ApiError(404, "Produto contratado nao encontrado.");
    const { clientId, productId, ...data } = input;
    const clientProduct = await this.repository.updateClientProduct(id, {
      ...data,
      client: { connect: { id: clientId } },
      product: { connect: { id: productId } }
    });
    await this.auditRepository.log({ userId, clientId, entity: "ClientProduct", entityId: id, action: "UPDATED" });
    return clientProduct;
  }

  public async deleteClientProduct(id: string, userId: string): Promise<void> {
    const existing = await this.repository.findClientProduct(id, userId);
    if (!existing) throw new ApiError(404, "Produto contratado nao encontrado.");
    await this.repository.deleteClientProduct(id);
    await this.auditRepository.log({ userId, clientId: existing.clientId, entity: "ClientProduct", entityId: id, action: "DELETED" });
  }
}
