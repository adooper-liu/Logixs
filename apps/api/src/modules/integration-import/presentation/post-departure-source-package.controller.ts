import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  PostDepartureSourcePackagePreflightResultV1,
  PostDepartureSourcePackageReviewResultV1,
  PostDepartureReferencePortSearchResultV1,
  PostDepartureSourceCandidateCorrectionResultV1,
  PostDepartureSourceCandidateAcceptResultV1,
  PostDepartureSourcePackageAcceptResultV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { CorrectPostDepartureSourceCandidateService } from "../application/correct-post-departure-source-candidate.service";
import { CompletePostDepartureCandidateCargoService } from "../application/complete-post-departure-candidate-cargo.service";
import { PreflightPostDepartureSourcePackageService } from "../application/preflight-post-departure-source-package.service";
import { SavePostDepartureSourcePackageReviewService } from "../application/save-post-departure-source-package-review.service";
import { SearchPostDepartureReferencePortsService } from "../application/search-post-departure-reference-ports.service";
import { AcceptPostDepartureSourceCandidateService } from "../application/accept-post-departure-source-candidate.service";
import { AcceptPostDepartureSourcePackageService } from "../application/accept-post-departure-source-package.service";
import {
  PostDepartureSourcePackagePreflightRequestDto,
  PostDepartureSourcePackageReviewRequestDto,
  PostDepartureReferencePortQueryDto,
  PostDepartureSourceCandidateCorrectionRequestDto,
  PostDepartureSourceCandidateCargoRequestDto,
  PostDepartureSourceCandidateAcceptRequestDto,
  PostDepartureSourcePackageAcceptRequestDto,
} from "./post-departure-source-package.dto";

@ApiTags("post-departure-source-packages")
@Controller("post-departure-source-packages")
export class PostDepartureSourcePackageController {
  constructor(
    private readonly preflightPackage: PreflightPostDepartureSourcePackageService,
    private readonly savePackageReview: SavePostDepartureSourcePackageReviewService,
    private readonly correctCandidate: CorrectPostDepartureSourceCandidateService,
    private readonly completeCandidateCargo: CompletePostDepartureCandidateCargoService,
    private readonly searchPorts: SearchPostDepartureReferencePortsService,
    private readonly acceptCandidate: AcceptPostDepartureSourceCandidateService,
    private readonly acceptPackage: AcceptPostDepartureSourcePackageService,
  ) {}

  @Get("reference-ports")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ description: "Active UN/LOCODE port search" })
  async searchReferencePorts(
    @Query() query: PostDepartureReferencePortQueryDto,
  ): Promise<PostDepartureReferencePortSearchResultV1> {
    const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
    return this.searchPorts.execute({
      query: query.query,
      pageSize,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  }

  @Post("preflight")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ description: "Four-source post-departure preflight" })
  preflight(
    @Body() body: PostDepartureSourcePackagePreflightRequestDto,
    @Req() request: { identity: { tenantId: string } },
  ): Promise<PostDepartureSourcePackagePreflightResultV1> {
    return this.preflightPackage.execute(body, request.identity.tenantId);
  }

  @Post(":packageId/reviews")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ description: "Saved post-departure review package receipt" })
  saveReview(
    @Param("packageId") packageId: string,
    @Body() body: PostDepartureSourcePackageReviewRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PostDepartureSourcePackageReviewResultV1> {
    return this.savePackageReview.execute(
      packageId,
      body,
      request.identity.tenantId,
      request.identity.actorId,
    );
  }

  @Post(":packageId/reviews/:reviewId/candidates/:candidateRef/corrections")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ description: "Saved controlled candidate correction" })
  correct(
    @Param("packageId") packageId: string,
    @Param("reviewId") reviewId: string,
    @Param("candidateRef") candidateRef: string,
    @Body() body: PostDepartureSourceCandidateCorrectionRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PostDepartureSourceCandidateCorrectionResultV1> {
    return this.correctCandidate.execute(
      packageId,
      reviewId,
      candidateRef,
      body,
      request.identity.tenantId,
      request.identity.actorId,
    );
  }

  @Post(":packageId/reviews/:reviewId/candidates/:candidateRef/cargo-lines")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ description: "Saved candidate SKU loading details" })
  completeCargo(
    @Param("packageId") packageId: string,
    @Param("reviewId") reviewId: string,
    @Param("candidateRef") candidateRef: string,
    @Body() body: PostDepartureSourceCandidateCargoRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PostDepartureSourceCandidateCorrectionResultV1> {
    return this.completeCandidateCargo.execute(
      packageId,
      reviewId,
      candidateRef,
      body,
      request.identity.tenantId,
      request.identity.actorId,
    );
  }

  @Post(":packageId/candidates/:candidateRef/accept")
  @RequireCapabilities("import.execute")
  @ApiOkResponse({ description: "Accepted post-departure Shipment" })
  accept(
    @Param("packageId") packageId: string,
    @Param("candidateRef") candidateRef: string,
    @Body() body: PostDepartureSourceCandidateAcceptRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PostDepartureSourceCandidateAcceptResultV1> {
    return this.acceptCandidate.execute(
      packageId,
      candidateRef,
      body,
      request.identity,
    );
  }

  @Post(":packageId/accept")
  @RequireCapabilities("import.execute")
  @ApiOkResponse({ description: "Accepted all available Shipment groups" })
  acceptAll(
    @Param("packageId") packageId: string,
    @Body() body: PostDepartureSourcePackageAcceptRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<PostDepartureSourcePackageAcceptResultV1> {
    return this.acceptPackage.execute(packageId, body, request.identity);
  }
}
