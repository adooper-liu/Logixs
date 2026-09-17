import { SetMetadata } from "@nestjs/common";

export const PUBLIC_ENDPOINT_KEY = "logix.publicEndpoint";
export const SERVICE_ENDPOINT_KEY = "logix.serviceEndpoint";

export const PublicEndpoint = (): ClassDecorator & MethodDecorator =>
  SetMetadata(PUBLIC_ENDPOINT_KEY, true);

export const ServiceEndpoint = (): ClassDecorator & MethodDecorator =>
  SetMetadata(SERVICE_ENDPOINT_KEY, true);
