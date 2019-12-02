import { PolarisGraphQLContext } from '@enigmatis/polaris-common';
import { PolarisGraphQLLogger } from '@enigmatis/polaris-graphql-logger';
import { Connection, In, Not } from '@enigmatis/polaris-typeorm';

export class IrrelevantEntitiesMiddleware {
    public readonly connection?: Connection;
    public readonly logger: PolarisGraphQLLogger;

    constructor(logger: PolarisGraphQLLogger, connection?: Connection) {
        this.connection = connection;
        this.logger = logger;
    }

    public getMiddleware() {
        return async (
            resolve: any,
            root: any,
            args: { [argName: string]: any },
            context: PolarisGraphQLContext,
            info: any,
        ) => {
            this.logger.debug('Irrelevant entities middleware started job', { context });
            const result = await resolve(root, args, context, info);
            if (
                context &&
                context.requestHeaders &&
                context.requestHeaders.dataVersion !== undefined &&
                !isNaN(context.requestHeaders.dataVersion) &&
                info.returnType.ofType &&
                this.connection &&
                !root
            ) {
                const irrelevantWhereCriteria: any =
                    Array.isArray(result) && result.length > 0
                        ? { id: Not(In(result.map((x: any) => x.id))) }
                        : {};
                irrelevantWhereCriteria.deleted = In([true, false]);
                irrelevantWhereCriteria.realityId = context.requestHeaders.realityId;

                let type = info.returnType;
                while (!type.name) {
                    type = type.ofType;
                }
                const typeName = type.name;

                const resultIrrelevant: any = await this.connection.getRepository(typeName).find({
                    select: ['id'],
                    where: irrelevantWhereCriteria,
                });
                if (resultIrrelevant && resultIrrelevant.length > 0) {
                    const irrelevantEntities: any = {};
                    irrelevantEntities[info.path.key] = resultIrrelevant.map((x: any) => x.id);
                    if (!context.returnedExtensions) {
                        context.returnedExtensions = {} as any;
                    }
                    context.returnedExtensions = {
                        ...context.returnedExtensions,
                        irrelevantEntities: {
                            ...context.returnedExtensions.irrelevantEntities,
                            ...irrelevantEntities,
                        },
                    } as any;
                }
            }
            this.logger.debug('Irrelevant entities middleware finished job', { context });
            return result;
        };
    }
}